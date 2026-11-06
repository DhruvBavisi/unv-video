import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRoleImage, getRoleBadgeImage } from '../src/games/undercover/roleImages.js';
import { SPECIAL_ROLES } from '../src/games/undercover/data/specialRoles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

console.log('Testing Undercover Character Asset Relocation...');

// 1. Verify no loose files remain in public/images/characters/
const charBaseDir = path.join(publicDir, 'images', 'characters');
const looseFiles = fs.readdirSync(charBaseDir, { withFileTypes: true }).filter(i => i.isFile());
assert.strictEqual(looseFiles.length, 0, 'No loose files should remain in public/images/characters');
console.log('PASS: No loose files remain in public/images/characters');

// 2. Verify subdirectories structure
const subdirs = fs.readdirSync(charBaseDir, { withFileTypes: true })
  .filter(i => i.isDirectory())
  .map(i => i.name)
  .sort();
assert.deepStrictEqual(subdirs, ['codenames', 'skribbl', 'undercover']);
console.log('PASS: Characters folder strictly contains [codenames, skribbl, undercover]');

// 3. Verify core role images exist
const coreRoles = ['CIVILIAN', 'UNDERCOVER', 'MR_WHITE'];
for (const role of coreRoles) {
  const imgUrl = getRoleImage(role);
  assert.ok(imgUrl.startsWith('/images/characters/undercover/'), `${role} role image must be under /undercover/`);
  const filePath = path.join(publicDir, imgUrl.replace(/^\//, ''));
  assert.ok(fs.existsSync(filePath), `File exists for ${role} role image: ${filePath}`);

  const badgeUrl = getRoleBadgeImage(role);
  assert.ok(badgeUrl.startsWith('/images/characters/undercover/'), `${role} badge image must be under /undercover/`);
  const badgeFilePath = path.join(publicDir, badgeUrl.replace(/^\//, ''));
  assert.ok(fs.existsSync(badgeFilePath), `File exists for ${role} badge image: ${badgeFilePath}`);
}
console.log('PASS: Core role images and badges mapped and exist on disk');

// 4. Verify all special roles avatars and bg variants exist
for (const role of SPECIAL_ROLES) {
  assert.ok(role.avatar.startsWith('/images/characters/undercover/'), `${role.name} avatar must start with /images/characters/undercover/`);
  const diskPath = path.join(publicDir, role.avatar.replace(/^\//, ''));
  assert.ok(fs.existsSync(diskPath), `Avatar file exists for ${role.name}: ${diskPath}`);

  // Also verify -bg.webp variant exists
  const bgDiskPath = path.join(publicDir, role.avatar.replace(/^\//, '').replace(/\.(png|webp)$/, '-bg.webp'));
  assert.ok(fs.existsSync(bgDiskPath), `Background avatar exists for ${role.name}: ${bgDiskPath}`);
}
console.log('PASS: All 9 special roles avatars and -bg variants verified on disk');

// 5. Verify special variants and overlay assets
const greenGoddess = path.join(publicDir, 'images', 'characters', 'undercover', 'goddessofjustice-bg-green.webp');
assert.ok(fs.existsSync(greenGoddess), 'goddessofjustice-bg-green.webp exists on disk');
const mrwhiteOverlay = path.join(publicDir, 'images', 'characters', 'undercover', 'mrwhite-1.webp');
assert.ok(fs.existsSync(mrwhiteOverlay), 'mrwhite-1.webp exists on disk');
console.log('PASS: Special variants and elimination overlay character assets verified');

// 6. Verify total file count in undercover folder (strictly 25 active .webp assets, 0 unused .png/strips)
const undercoverDir = path.join(publicDir, 'images', 'characters', 'undercover');
const ucFiles = fs.readdirSync(undercoverDir, { withFileTypes: true }).filter(i => i.isFile());
assert.strictEqual(ucFiles.length, 25, 'Exactly 25 active undercover asset files present');
for (const file of ucFiles) {
  assert.ok(file.name.endsWith('.webp'), `File ${file.name} must be a WebP asset`);
  assert.ok(!file.name.endsWith('.png'), `No unused PNG file should remain: ${file.name}`);
}
console.log('PASS: Exactly 25 clean, active .webp undercover character assets verified');

console.log('All Undercover character asset relocation tests passed!');

