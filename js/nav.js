// Tiny view router. Each view is a <section id="<name>-view">; exactly one is visible at a time.
import { $ } from 'util';

const views = {};
let current = null;

export const register = (name, hooks = {}) => { views[name] = hooks; }; // hooks: { enter(arg), leave() }
export const currentView = () => current;

export async function go(name, arg) {
  if (current && current !== name) views[current].leave?.();
  for (const n of Object.keys(views)) $(`${n}-view`).classList.toggle('hidden', n !== name);
  current = name;
  await views[name].enter?.(arg);
}
