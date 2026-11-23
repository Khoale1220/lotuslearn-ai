const CLASSROOM_WORLD_FIXTURE = Object.freeze({
  classroomKey: "cw03-spike",
  students: Object.freeze([
    Object.freeze({
      studentKey: "student-01",
      seatIndex: 0,
      displayLabel: "Student 01",
      visualState: "default"
    })
  ])
});

const PIXEL_RENDER_CONFIG = Object.freeze({
  internalWidth: 320,
  internalHeight: 180,
  textureFilter: "nearest"
});

const INTERACTION_DISTANCE = 2.5;

function seatToWorld(seatIndex) {
  if (!Number.isInteger(seatIndex) || seatIndex < 0) {
    throw new RangeError("seatIndex must be a non-negative integer");
  }

  const seatsPerRow = 6;
  const column = seatIndex % seatsPerRow;
  const row = Math.floor(seatIndex / seatsPerRow);

  return {
    x: (column - 2.5) * 2,
    y: 0,
    z: -4 - row * 2.5
  };
}

export {
  CLASSROOM_WORLD_FIXTURE,
  PIXEL_RENDER_CONFIG,
  INTERACTION_DISTANCE,
  seatToWorld
};
