import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRoleImage, getRoleBadgeImage } from '../src/games/undercover/roleImages.js';
import { SPECIAL_ROLES } from '../src/games/undercover/data/specialRoles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

console.log('Testing Undercover Character Asset Resolution & Dual-Path Resilience...');

// 1. Verify subdirectories structure
const charBaseDir = path.join(publicDir, 'images', 'characters');
const subdirs = fs.readdirSync(charBaseDir, { withFileTypes: true })
  .filter(i => i.isDirectory())
  .map(i => i.name)
  .sort();
assert.ok(subdirs.includes('undercover'), 'Characters folder must contain undercover subdirectory');
assert.ok(subdirs.includes('skribbl'), 'Characters folder must contain skribbl subdirectory');
assert.ok(subdirs.includes('codenames'), 'Characters folder must contain codenames subdirectory');
console.log('PASS: Characters folder contains [codenames, skribbl, undercover]');

// 2. Verify core role images exist under /undercover/ and at root compatibility path
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

  // Also verify root compatibility path exists
  const rootCompPath = path.join(publicDir, 'images', 'characters', path.basename(filePath));
  assert.ok(fs.existsSync(rootCompPath), `Root compatibility file exists: ${rootCompPath}`);
}
console.log('PASS: Core role images and badges mapped and exist on disk with root fallback');

// 3. Verify all special roles avatars and bg variants exist
for (const role of SPECIAL_ROLES) {
  assert.ok(role.avatar.startsWith('/images/characters/undercover/'), `${role.name} avatar must start with /images/characters/undercover/`);
  const diskPath = path.join(publicDir, role.avatar.replace(/^\//, ''));
  assert.ok(fs.existsSync(diskPath), `Avatar file exists for ${role.name}: ${diskPath}`);

  // Also verify -bg.webp variant exists
  const bgDiskPath = path.join(publicDir, role.avatar.replace(/^\//, '').replace(/\.(png|webp)$/, '-bg.webp'));
  assert.ok(fs.existsSync(bgDiskPath), `Background avatar exists for ${role.name}: ${bgDiskPath}`);

  // Root compatibility path
  const rootAvatar = path.join(publicDir, 'images', 'characters', path.basename(diskPath));
  assert.ok(fs.existsSync(rootAvatar), `Root compatibility avatar exists: ${rootAvatar}`);
}
console.log('PASS: All 9 special roles avatars and -bg variants verified on disk with dual-path resilience');

// 4. Verify special variants and overlay assets
const greenGoddess = path.join(publicDir, 'images', 'characters', 'undercover', 'goddessofjustice-bg-green.webp');
assert.ok(fs.existsSync(greenGoddess), 'goddessofjustice-bg-green.webp exists on disk');
const mrwhiteOverlay = path.join(publicDir, 'images', 'characters', 'undercover', 'mrwhite-1.webp');
assert.ok(fs.existsSync(mrwhiteOverlay), 'mrwhite-1.webp exists on disk');
console.log('PASS: Special variants and elimination overlay character assets verified');

// 5. Verify WebP assets and PNG fallbacks in undercover directory
const undercoverDir = path.join(publicDir, 'images', 'characters', 'undercover');
const ucWebpFiles = fs.readdirSync(undercoverDir, { withFileTypes: true }).filter(i => i.isFile() && i.name.endsWith('.webp'));
assert.ok(ucWebpFiles.length >= 25, `At least 25 active WebP assets present in undercover (found ${ucWebpFiles.length})`);

const ucPngFiles = fs.readdirSync(undercoverDir, { withFileTypes: true }).filter(i => i.isFile() && i.name.endsWith('.png'));
assert.ok(ucPngFiles.length >= 20, `PNG fallback assets present in undercover directory for Safari resilience (found ${ucPngFiles.length})`);
console.log('PASS: WebP assets and PNG fallbacks verified for complete browser resilience');

console.log('All Undercover character asset resolution tests passed!');
