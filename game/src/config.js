// Sunset Streets — tuning for the fictional coastal city of Solmar Bay.
// Every distance is in world pixels unless a comment says otherwise. The city
// is a grid: vertical avenues and horizontal streets, with building blocks
// tucked into the cells between the roads.
export const WORLD = {
  width: 3600,
  height: 2700,
  block: 300, // pitch from one road centre line to the next
  road: 72, // width of a road strip
  sidewalk: 18, // pavement ring around each building block
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38, // seconds between punches
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420, // px/s^2 when the throttle is down
  brake: 620,
  maxSpeed: 460,
  maxReverse: 150,
  turnRate: 2.9, // radians per second at full lock
  drag: 0.9, // coasting slowdown factor
};

// How the Solmar Bay PD behaves. Ramming and busting are tuned to pressure
// the player, not to end a run in one touch.
export const POLICE = {
  chaseSpeed: 430,
  ramDamage: 6, // health lost to one ram while driving
  ramCooldown: 1.2, // seconds between rams from the same unit
  arrestRange: 46, // how close a foot officer must be to start a bust
  bustTime: 3.0, // seconds inside arrest range before you are busted
  footSpeed: 190,
  sprintEscapeFactor: 0.5, // bust timer builds half as fast while sprinting
};

// The air unit was cut for the round-4 rewrite: the chase stays on the
// ground (cars + officers on foot) to keep the build tight and testable.

export const WANTED = {
  decaySeconds: 10, // seconds fully out of sight before one star drops
  starsForKill: 1,
  starsForSteal: 1,
  maxStars: 5,
};

export const COLORS = {
  grass: '#7fae62',
  sand: '#e8d39a',
  water: '#3f8fbf',
  road: '#3a3f46',
  roadLine: '#e8d44f',
  sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#4a7fa5', '#a5a44a', '#8a5fa0', '#5fa08a', '#b04a6a'],
  player: '#ffd23f',
  police: '#2f6fd0',
  heli: '#22303f',
  traffic: ['#d94f3d', '#3d7dd9', '#e8e8e8', '#4caf50', '#ff9800', '#9c27b0'],
};

export const MISSIONS = [
  {
    id: 'fare',
    title: 'First Fare',
    giver: 'Lena Ortiz',
    briefing: 'A client waits at the Marina. Pick them up and drop them at the Grand Hotel before they lose patience.',
    steps: ['Drive to the Marina pickup', 'Pick up the client (stop in the marker)', 'Deliver the client to the Grand Hotel'],
    reward: 250,
  },
  {
    id: 'delivery',
    title: 'Hot Delivery',
    giver: 'Lena Ortiz',
    briefing: 'A sealed case has to reach the Docks in 90 seconds. No questions, no stops, no police.',
    steps: ['Grab the case at the Plaza', 'Deliver it to the Docks within 90 seconds'],
    reward: 400,
    timer: 90,
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    giver: 'Marco Reyes',
    briefing: 'The job went loud. Three stars on your tail. Lose them and reach the Safehouse in Old Town.',
    steps: ['Reach the Safehouse in Old Town', 'Stay out of sight until the heat dies down'],
    reward: 600,
  },
  {
    id: 'stash',
    title: 'Stash Run',
    giver: 'Lena Ortiz',
    briefing: 'Three stashes are hidden around the city. Grab them all — the cops will notice.',
    steps: ['Collect stash 1 of 3', 'Collect stash 2 of 3', 'Collect stash 3 of 3'],
    reward: 750,
  },
  {
    id: 'sprint',
    title: 'Sunset Sprint',
    giver: 'Marco Reyes',
    briefing: 'Three checkpoints across the city, 75 seconds on the clock. Beat it and the street racers pay up.',
    steps: ['Reach checkpoint 1 of 3', 'Reach checkpoint 2 of 3', 'Reach checkpoint 3 of 3'],
    reward: 900,
    timer: 75,
    timerFromStart: true,
  },
  {
    id: 'vault',
    title: 'Vault Job',
    giver: 'Lena Ortiz',
    briefing: 'The Solmar Bank vault case is unguarded for once. Grab it and get it to the Safehouse — the PD will not take it lightly.',
    steps: ['Grab the vault case at Solmar Bank', 'Deliver the case to the Safehouse'],
    reward: 1200,
  },
];

// Crash and skid effects: skid-mark lifetime, how many the game keeps,
// how long smoke hangs, and how many sparks a hard impact throws.
export const EFFECTS = {
  skidLife: 6,
  maxSkids: 150,
  smokeLife: 1.4,
  sparkCount: 14,
};

export const SAVE_KEY = 'sunset-streets-save-v1';

// A new game starts with a little cash and a box of pistol ammo.
export const STARTING = {
  money: 120,
  ammo: 24,
};
