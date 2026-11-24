# Acceptance criteria for the reservation E2E tests (Lab 9). Playwright specs
# implement these steps; there is no Gherkin runner.
#
# Conventions:
# - "tomorrow" is the day after the test run, so the scenarios never expire.
# - Times are the student's local time, as entered in the booking form.
# - Each scenario starts from only the resources and reservations its Given
#   steps describe.

Feature: Reserve a campus resource
  As a student
  I want to reserve an available campus resource for a time window
  So that I can use it without double-booking another student's time

  Scenario: Student reserves an available study room and sees it in My Bookings
    Given I am using CampusHub as student "student-001"
    And the room "Study Room 101" in "Library - First Floor" is available for booking
    And "Study Room 101" has no reservations tomorrow
    And I have no active bookings
    When I open CampusHub
    And I filter the resource directory by "Room"
    And I select "Study Room 101" for booking
    And I enter a time window from 10:00 to 11:00 tomorrow
    And I submit the booking
    Then I see a confirmation that "Study Room 101" is booked from 10:00 to 11:00 tomorrow with status "Pending"
    And My Bookings lists "Study Room 101" from 10:00 to 11:00 tomorrow with status "Pending"

  Scenario: Student is alerted that a study room is already booked for an overlapping time
    Given I am using CampusHub as student "student-001"
    And the room "Study Room 102" in "Library - Second Floor" is available for booking
    And student "student-002" has a pending reservation for "Study Room 102" from 14:00 to 15:00 tomorrow
    And I have no active bookings
    When I open CampusHub
    And I filter the resource directory by "Room"
    And I select "Study Room 102" for booking
    And I enter a time window from 14:30 to 15:30 tomorrow
    And I submit the booking
    Then I see the alert "This resource is already reserved for the selected time window."
    And I do not see a booking confirmation
    And My Bookings shows that I have no active bookings
    And "Study Room 102" still has only one reservation tomorrow, held by "student-002" from 14:00 to 15:00
