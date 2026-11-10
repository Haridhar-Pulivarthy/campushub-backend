import { ResourceModel } from "../models/Resource.model.js";

describe("in-memory MongoDB", (): void => {
  it("round-trips a document through Mongoose", async (): Promise<void> => {
    const created = await ResourceModel.create({
      name: "Smoke Test Room",
      type: "ROOM",
      location: "Building A",
      isAvailable: true,
    });

    const found = await ResourceModel.findById(created._id).lean();

    expect(found).toMatchObject({
      name: "Smoke Test Room",
      type: "ROOM",
      location: "Building A",
      isAvailable: true,
    });
  });

  it("starts each test with empty collections", async (): Promise<void> => {
    await expect(ResourceModel.countDocuments()).resolves.toBe(0);
  });
});
