import { describe, expect, it } from 'vitest';
import { DEFAULT_MAPPING_RULES } from '@thenexus/mapping';
import { approachCells, findPathToTarget } from '@thenexus/world-engine/core';
import { buildDemoShip } from './demo-ship';

describe('demo ship static guarantees', () => {
  it('covers every DEFAULT_MAPPING_RULES room type', () => {
    const ship = buildDemoShip();
    const ruleRooms = new Set(DEFAULT_MAPPING_RULES.map((rule) => rule.preferredRoomType));
    const shipRooms = new Set(ship.rooms.map((room) => room.roomType));
    for (const roomType of ruleRooms) {
      expect(shipRooms.has(roomType), `missing room type ${roomType}`).toBe(true);
    }
  });

  it('contains every DEFAULT_MAPPING_RULES station type', () => {
    const ship = buildDemoShip();
    const ruleStations = new Set(DEFAULT_MAPPING_RULES.map((rule) => rule.preferredStationType));
    const shipStations = new Set(ship.stations.map((station) => station.stationType));
    for (const stationType of ruleStations) {
      expect(shipStations.has(stationType), `missing station type ${stationType}`).toBe(true);
    }
  });

  it('gives every station at least one walkable approach cell', () => {
    const ship = buildDemoShip();
    expect(ship.stations.length).toBeGreaterThan(0);
    for (const station of ship.stations) {
      const approach = approachCells(ship.grid, station.footprint);
      expect(
        approach.length,
        `station ${station.stationInstanceId} has no approach cell`,
      ).toBeGreaterThan(0);
    }
  });

  it('reaches every station from the first spawn cell', () => {
    const ship = buildDemoShip();
    const start = ship.spawnCells[0];
    expect(start).toBeDefined();
    if (start === undefined) return;
    for (const station of ship.stations) {
      const path = findPathToTarget(ship.grid, start, station.footprint);
      expect(path.status, `station ${station.stationInstanceId}: ${path.status}`).toBe('OK');
    }
  });

  it('offers enough spawn cells for the 250-agent stress scenario', () => {
    const ship = buildDemoShip();
    expect(ship.spawnCells.length).toBeGreaterThanOrEqual(250);
  });

  it('rebuilds byte-identically', () => {
    const a = JSON.stringify(structuralOf(buildDemoShip()));
    const b = JSON.stringify(structuralOf(buildDemoShip()));
    expect(a).toBe(b);
  });

  it('keeps mapping layout ids consistent with ship views', () => {
    const ship = buildDemoShip();
    const roomIds = new Set(ship.rooms.map((room) => room.roomInstanceId));
    for (const room of ship.mappingLayout.rooms) {
      expect(roomIds.has(room.roomInstanceId)).toBe(true);
    }
    const stationIds = new Set(ship.stations.map((station) => station.stationInstanceId));
    for (const station of ship.mappingLayout.stations) {
      expect(stationIds.has(station.stationInstanceId)).toBe(true);
      expect(roomIds.has(station.roomInstanceId)).toBe(true);
    }
  });
});

function structuralOf(ship: ReturnType<typeof buildDemoShip>): unknown {
  const blocked: number[] = [];
  for (let y = 0; y < ship.grid.height; y++) {
    for (let x = 0; x < ship.grid.width; x++) {
      if (ship.grid.isBlocked(x, y)) blocked.push(y * ship.grid.width + x);
    }
  }
  return {
    blocked,
    rooms: ship.rooms.map((r) => [r.roomInstanceId, r.roomType, r.rect]),
    stations: ship.stations.map((s) => [s.stationInstanceId, s.stationType, s.footprint]),
  };
}
