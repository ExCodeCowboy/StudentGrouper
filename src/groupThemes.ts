import type { Group, GroupSet } from './model';

export type GroupThemeId = NonNullable<GroupSet['nameTheme']>;
type Theme = { id: GroupThemeId; name: string; description: string; teams: readonly (readonly [string, string])[] };

export const groupThemes: readonly Theme[] = [
  { id: 'woodland', name: 'Woodland Friends', description: 'A little forest full of big adventures.', teams: [
    ['Friendly Foxes', '🦊'], ['Brave Bears', '🐻'], ['Bright Owls', '🦉'], ['Happy Hedgehogs', '🦔'],
    ['Bouncy Bunnies', '🐰'], ['Clever Raccoons', '🦝'], ['Busy Beavers', '🦫'], ['Daring Deer', '🦌'],
    ['Super Squirrels', '🐿️'], ['Merry Mice', '🐭'], ['Playful Badgers', '🦡'], ['Little Wolves', '🐺'],
  ] },
  { id: 'space', name: 'Space Explorers', description: 'Teams ready for an out-of-this-world day.', teams: [
    ['Moon Walkers', '🌙'], ['Rocket Racers', '🚀'], ['Saturn Stars', '🪐'], ['Earth Explorers', '🌍'],
    ['Mars Rovers', '🔴'], ['Comet Crew', '☄️'], ['Sun Beams', '☀️'], ['Star Seekers', '⭐'],
    ['Galaxy Gliders', '🌌'], ['Astro Buddies', '🧑‍🚀'], ['Neptune Navigators', '🔵'], ['Satellite Scouts', '🛰️'],
  ] },
  { id: 'ocean', name: 'Ocean Crew', description: 'Dive into a sea of discovery.', teams: [
    ['Dancing Dolphins', '🐬'], ['Terrific Turtles', '🐢'], ['Curious Octopuses', '🐙'], ['Wonderful Whales', '🐳'],
    ['Clever Crabs', '🦀'], ['Super Sharks', '🦈'], ['Puffer Pals', '🐡'], ['Tropical Fish', '🐠'],
    ['Jolly Jellyfish', '🪼'], ['Smiling Seals', '🦭'], ['Ocean Otters', '🦦'], ['Seashell Seekers', '🐚'],
  ] },
  { id: 'garden', name: 'Garden Buddies', description: 'Small friends, growing great things.', teams: [
    ['Busy Bees', '🐝'], ['Lucky Ladybugs', '🐞'], ['Bright Butterflies', '🦋'], ['Sunny Sunflowers', '🌻'],
    ['Happy Hoppers', '🦗'], ['Silly Snails', '🐌'], ['Clever Caterpillars', '🐛'], ['Friendly Frogs', '🐸'],
    ['Little Sprouts', '🌱'], ['Daisy Dreamers', '🌼'], ['Tulip Team', '🌷'], ['Cherry Cheerers', '🍒'],
  ] },
  { id: 'dinosaurs', name: 'Dino Discoverers', description: 'Tiny teams with a mighty roar.', teams: [
    ['Tiny T-Rexes', '🦖'], ['Bronto Buddies', '🦕'], ['Fossil Finders', '🦴'], ['Volcano Voyagers', '🌋'],
    ['Hatching Heroes', '🥚'], ['Footprint Friends', '🐾'], ['Fern Explorers', '🌿'], ['Pebble Pals', '🪨'],
    ['Sunny Stompers', '☀️'], ['Digging Dynamos', '⛏️'], ['Dino Trackers', '🧭'], ['Feather Flyers', '🪶'],
  ] },
  { id: 'weather', name: 'Weather Wonders', description: 'A bright forecast for learning together.', teams: [
    ['Rainbow Chasers', '🌈'], ['Cloud Cruisers', '☁️'], ['Sunshine Squad', '☀️'], ['Snowflake Friends', '❄️'],
    ['Raindrop Racers', '💧'], ['Lightning Bolts', '⚡'], ['Breezy Buddies', '🍃'], ['Umbrella Crew', '☂️'],
    ['Snowman Smiles', '⛄'], ['Misty Mountains', '🏔️'], ['Puddle Jumpers', '💦'], ['Starry Skies', '🌠'],
  ] },
  { id: 'storybook', name: 'Storybook Friends', description: 'Every team has a little magic.', teams: [
    ['Kind Unicorns', '🦄'], ['Daring Dragons', '🐉'], ['Friendly Fairies', '🧚'], ['Wonder Wizards', '🧙'],
    ['Castle Crew', '🏰'], ['Royal Readers', '👑'], ['Storybook Stars', '📖'], ['Magic Makers', '🪄'],
    ['Treasure Seekers', '💎'], ['Potion Pals', '🧪'], ['Clever Elves', '🧝'], ['Wishing Wells', '⛲'],
  ] },
  { id: 'builders', name: 'Busy Builders', description: 'Big ideas start with helping hands.', teams: [
    ['Brilliant Builders', '🏗️'], ['Mighty Movers', '🚜'], ['Toolbox Team', '🧰'], ['Brick Buddies', '🧱'],
    ['Hammer Helpers', '🔨'], ['Measuring Masters', '📏'], ['Puzzle Planners', '🧩'], ['Bolt Buddies', '🔩'],
    ['Paintbrush Pals', '🖌️'], ['Bright Ideas', '💡'], ['Gear Gang', '⚙️'], ['Safety Stars', '🦺'],
  ] },
];

const colors = ['#3778b8', '#4c916a', '#a57520', '#b96159', '#8066a7', '#b66629', '#278c8a', '#b85d80', '#657ba9', '#8c7753', '#687e40', '#956cac'];

export function themedGroupLook(themeId: GroupThemeId | undefined, index: number): Pick<Group, 'name' | 'color' | 'symbol'> | undefined {
  const theme = groupThemes.find((item) => item.id === themeId);
  if (!theme) return undefined;
  const [name, symbol] = theme.teams[index % theme.teams.length];
  const cycle = Math.floor(index / theme.teams.length);
  return { name: cycle ? `${name} ${cycle + 1}` : name, symbol, color: colors[index % colors.length] };
}

// Group IDs are schedule references. A theme changes only the presentation.
export function applyGroupTheme(groupSet: GroupSet, themeId: GroupThemeId): GroupSet {
  if (!groupThemes.some((theme) => theme.id === themeId)) return groupSet;
  return {
    ...groupSet,
    nameTheme: themeId,
    groups: groupSet.groups.map((group, index) => ({ ...group, ...themedGroupLook(themeId, index), imageDataUrl: undefined })),
  };
}
