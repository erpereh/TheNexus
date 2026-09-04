// Strictness policy: schemas for UNTRUSTED-IMPORT surfaces (character packs,
// themes, blueprints, recordings, mapping rules) are .strict() so unknown
// fields are rejected at the boundary. Internal entity schemas (workspace,
// ship, crew, assignment) tolerate unknown fields for forward compatibility;
// they are written by the app itself, not imported from outside.
export * from './ids';
export * from './workspace';
export * from './ship';
export * from './crew';
export * from './assignment';
export * from './semantics';
export * from './mapping';
export * from './character-pack';
export * from './theme';
export * from './blueprint';
export * from './recording';
