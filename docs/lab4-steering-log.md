# Lab 4 Steering Log

Record of agent failures encountered while building and verifying the CampusHub
reservation API, and how each was steered to resolution.

---

### Incident 1: Cancellation test script exited with code 127 despite all assertions passing

**Context:** While implementing `PATCH /api/v1/reservations/:id/cancel`, the agent
verified the endpoint with a temporary Node.js script (`cancel-check.mjs`, kept in
the agent's scratch directory, outside the repository). The script compiled the
app with `tsc --outDir` to a scratch build, mounted the real `apiRouter` on an
Express server, replaced the Mongoose model methods with an in-memory store, and
sent real HTTP requests with `fetch`. No application code was involved in the
failure or its fix.

- **Initial Agent Output:**
  The first run printed all 19 checks as passing, then crashed during shutdown.
  The script's original teardown was:

  ```js
  process.stderr.write(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}\n`);
  server.close();
  process.exit(failures === 0 ? 0 : 1);
  ```

  End of the actual output:

  ```text
  PASS  same window while CONFIRMED -> 409  -> {"code":"RESERVATION_CONFLICT",...}
  PASS  same window after cancel -> 201  -> {"id":"6ad6deab73c3890fe0c2bc81",...,"status":"PENDING"}
  PASS  overlap with the new booking still -> 409  -> {"code":"RESERVATION_CONFLICT",...}

  ALL PASSED
  Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
  exit=127
  ```

  The script asked for exit code 0, but the shell reported 127. The output also
  contained an `Error: simulated DB failure (secret detail)` stack trace. That one
  was expected: the controller logs it while correctly returning the generic
  `500 INTERNAL_ERROR` response.

- **Root Cause:**
  The problem was in the test script's teardown, not in the cancellation endpoint.
  The script called `process.exit()` right after `server.close()`. At that point
  the HTTP keep-alive connections opened by `fetch` were still being closed. On
  Windows, libuv hit an internal assertion (`UV_HANDLE_CLOSING` in
  `src\win\async.c`) and aborted the process. That abort replaced the script's
  intended exit code 0 with a failure code, which Git Bash reported as 127.
  This diagnosis is inferred from the assertion message, the call order, and the
  fact that changing the teardown removed the crash. It was not traced inside
  Node's internals.

- **Remediation Prompt:**
  None. The user did not send a separate prompt for this. The agent noticed the
  mismatch between `ALL PASSED` and `exit=127` in the same turn, diagnosed it,
  fixed the script, and re-ran it without further instruction. Before the fix, it
  told the user that the assertions had passed but the process exit had failed,
  and that it was correcting the script's teardown.

- **Resolution:**
  The teardown was changed to set the exit code without forcing an exit, and to
  close open sockets before closing the server:

  ```js
  process.exitCode = failures === 0 ? 0 : 1;
  server.closeAllConnections();
  server.close();
  ```

  The rerun gave the same 19 passing checks and exited cleanly, with no libuv
  assertion:

  ```text
  PASS  overlap with the new booking still -> 409  -> {"code":"RESERVATION_CONFLICT",...}
  ALL PASSED
  exit=0
  ```

  Only the scratch test script changed; application code was untouched. The later
  real-MongoDB verification script (`db-check.mjs`) used the same pattern from the
  start: it sets `process.exitCode` inside a `finally` block and disconnects
  Mongoose instead of calling `process.exit()`. That run passed all 38 checks with
  `exit=0`.

- **Lessons Learned:**
  1. **Passing assertions and a successful process exit are separate signals.**
     An `ALL PASSED` line only shows what the script printed. CI and other
     automation look only at the exit code. A run is successful only when both
     agree, so test reports should state both.
  2. **Don't call `process.exit()` in a script that still has open handles**
     (servers, sockets, database connections). Set `process.exitCode`, close
     resources explicitly (`server.closeAllConnections()`, `server.close()`,
     `mongoose.disconnect()`), and let the event loop drain.
  3. **Check the exit code even when it doesn't change the verdict.** Here the
     failure was in teardown and the assertions were valid. But if the reported
     result is ignored, a crash that happens before any assertion runs looks the
     same as a pass.
  4. **Keep the exit code visible when piping output.** The rerun piped through
     `grep` and read `${PIPESTATUS[0]}`, so it reported the script's exit code
     rather than `grep`'s.
  5. **Tell expected noise apart from real errors.** The simulated-failure stack
     trace was the intended logging for the 500 path. The libuv assertion was a
     real fault. Reading stderr closely, rather than treating any stack trace as
     a failure (or ignoring all of them), is what told the two apart.
