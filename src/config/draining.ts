let draining = false;

export function isDraining() {
  return draining;
}

export function setDraining(value: boolean) {
  draining = value;
}
