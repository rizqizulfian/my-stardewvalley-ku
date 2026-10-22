// "Play together" panel: host a room or join one with its code, see who is
// in, copy the invite link. Plain DOM over the canvas (it needs real text
// inputs), styled like the touch buttons. A small badge at the top shows the
// room while one is open.

import { PALETTE } from '../art/palette';
import { audio } from '../audio/AudioManager';
import { COOP, NET, cleanCode, cleanName, coop } from '../net/coop';
import { bus } from '../systems/events';
import { state } from '../systems/GameState';

const NAME_KEY = 'lembah-padi-name';
const P = PALETTE;

const CSS = `
.lp-coop { position: fixed; inset: 0; z-index: 2000; display: none; align-items: center; justify-content: center;
  background: rgba(26, 20, 36, 0.55); font: 13px/1.4 ui-monospace, Menlo, Consolas, 'Courier New', monospace; }
.lp-coop.lp-open { display: flex; }
.lp-coop * { box-sizing: border-box; }
.lp-coop .lp-box { width: min(340px, calc(100vw - 32px)); max-height: calc(100dvh - 24px); overflow: auto;
  background: ${P.cream}; color: ${P.night}; border: 3px solid ${P.night}; border-radius: 4px;
  box-shadow: 0 5px 0 ${P.night}, inset -3px -3px 0 ${P.mist}; padding: 14px; }
.lp-coop h2 { margin: 0 0 8px; font-size: 15px; color: ${P.brick}; letter-spacing: 1px; text-transform: uppercase; }
.lp-coop p { margin: 6px 0; }
.lp-coop label { display: block; margin: 10px 0 3px; color: ${P.umber}; font-weight: bold; }
.lp-coop input { width: 100%; padding: 8px; font: inherit; font-size: 15px; color: ${P.night}; background: #fff;
  border: 2px solid ${P.night}; border-radius: 3px; user-select: text; -webkit-user-select: text; }
.lp-coop input.lp-code { text-transform: uppercase; letter-spacing: 4px; text-align: center; font-weight: bold; }
.lp-coop button { display: block; width: 100%; margin-top: 8px; padding: 9px 8px; font: inherit; font-weight: bold;
  color: ${P.night}; background: ${P.sand}; border: 2px solid ${P.night}; border-radius: 3px; cursor: pointer;
  box-shadow: 0 3px 0 ${P.night}; letter-spacing: 1px; }
.lp-coop button:active { transform: translateY(2px); box-shadow: 0 1px 0 ${P.night}; }
.lp-coop button.lp-quiet { background: ${P.mist}; }
.lp-coop button.lp-warn { background: ${P.peach}; }
.lp-coop button:disabled { opacity: 0.5; cursor: default; }
.lp-coop .lp-or { text-align: center; margin: 12px 0 0; color: ${P.mauve}; }
.lp-coop .lp-big { font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; color: ${P.brick};
  background: #fff; border: 2px dashed ${P.clay}; border-radius: 3px; padding: 6px; margin: 6px 0; user-select: text; -webkit-user-select: text; }
.lp-coop .lp-status { min-height: 1.4em; color: ${P.brick}; font-weight: bold; }
.lp-coop .lp-note { font-size: 11px; color: ${P.mauve}; }
.lp-coop ul { margin: 4px 0; padding-left: 18px; }
.lp-coop-badge { position: fixed; top: max(4px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 1500;
  display: none; padding: 3px 9px; font: bold 11px/1.3 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 1px;
  color: ${P.night}; background: ${P.cream}; border: 2px solid ${P.night}; border-radius: 3px; opacity: 0.85; cursor: pointer;
  -webkit-tap-highlight-color: transparent; user-select: none; }
.lp-coop-badge.lp-on { display: block; }
/* Narrow phones: below the on-screen Menu/Tas buttons. */
@media (max-width: 520px) { .lp-coop-badge { top: calc(max(4px, env(safe-area-inset-top)) + 58px); } }
`;

let root: HTMLDivElement | null = null;
let box: HTMLDivElement;
let badge: HTMLDivElement;
let busy = false;
/** Code from an invite link (?room=CODE), offered when the panel opens. */
let invited = '';

function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? state.name;
  } catch {
    return state.name;
  }
}

function rememberName(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    // Not remembered this time.
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function inviteLink(): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', coop.code);
  // Testing against a self-run broker: the friend needs it too.
  const peer = new URLSearchParams(window.location.search).get('peer');
  if (peer) url.searchParams.set('peer', peer);
  return url.toString();
}

function playerList(): string {
  return `<ul>${coop.players.map((p) => `<li>${esc(p.name)}${p.id === 'h' ? ' (host)' : ''}${p.id === coop.me.id ? ' - you' : ''}</li>`).join('')}</ul>`;
}

function render(): void {
  if (!root) return;
  badge.classList.toggle('lp-on', coop.active);
  badge.textContent = coop.active ? `Room ${coop.code} · ${coop.players.length}/${COOP.maxPlayers}` : '';
  const status = `<p class="lp-status">${esc(coop.status)}</p>`;
  if (coop.isHost) {
    box.innerHTML = `
      <h2>Play together</h2>
      <p>Your room code:</p>
      <div class="lp-big">${esc(coop.code)}</div>
      <p>Friends open the game and type this code under <b>Join</b>, or just open the invite link.</p>
      <button data-act="copy">Copy invite link</button>
      ${'share' in navigator ? '<button data-act="share" class="lp-quiet">Share invite...</button>' : ''}
      <label>On the farm (${coop.players.length}/${COOP.maxPlayers})</label>
      ${playerList()}
      ${status}
      <p class="lp-note">Keep this game open and in front while friends play: the farm lives in your game, and phones pause tabs left in the background (send the link, then come straight back). It saves when you sleep.</p>
      <button data-act="close" class="lp-quiet">Back to the game</button>
      <button data-act="leave" class="lp-warn">Close the room</button>`;
    return;
  }
  if (coop.isGuest) {
    box.innerHTML = `
      <h2>Play together</h2>
      <p>You are on <b>${esc(coop.nameOf('h'))}</b>'s farm. Room code:</p>
      <div class="lp-big">${esc(coop.code)}</div>
      <label>On the farm (${coop.players.length}/${COOP.maxPlayers})</label>
      ${playerList()}
      ${status}
      <p class="lp-note">The host's game keeps the farm saved. Your own farm is untouched and comes back when you leave.</p>
      <button data-act="close" class="lp-quiet">Back to the game</button>
      <button data-act="leave" class="lp-warn">Leave the room</button>`;
    return;
  }
  box.innerHTML = `
    <h2>Play together</h2>
    <p>Farm with up to ${COOP.maxPlayers - 1} friends. One of you hosts; the others join with the room code.</p>
    <label for="lp-name">Your name</label>
    <input id="lp-name" maxlength="${COOP.nameMax}" autocomplete="nickname" value="${esc(savedName())}" placeholder="e.g. Zul">
    <button data-act="host" ${busy ? 'disabled' : ''}>Host a room (your farm)</button>
    <p class="lp-or">or join a friend</p>
    <label for="lp-code">Room code</label>
    <input id="lp-code" class="lp-code" maxlength="${COOP.codeLength}" autocomplete="off" autocapitalize="characters" value="${esc(invited)}" placeholder="ABCDE">
    <button data-act="join" ${busy ? 'disabled' : ''}>Join</button>
    ${status}
    <p class="lp-note">Some strict networks (certain office, school or mobile networks) block player-to-player connections. If joining fails, try home Wi-Fi or a phone hotspot.</p>
    <button data-act="close" class="lp-quiet">Back to the game</button>`;
}

function nameInput(): string {
  const el = box.querySelector<HTMLInputElement>('#lp-name');
  const n = cleanName(el?.value ?? '');
  if (n) rememberName(n);
  return n;
}

async function act(what: string): Promise<void> {
  audio.playSfx('uiClick', 0.7);
  switch (what) {
    case 'close':
      closeCoopPanel();
      return;
    case 'host': {
      const name = nameInput();
      if (!name) {
        coop.status = 'Type your name first.';
        render();
        return;
      }
      busy = true;
      try {
        await coop.host(name);
      } catch {
        // coop.status says why.
      }
      busy = false;
      render();
      return;
    }
    case 'join': {
      const name = nameInput();
      const code = cleanCode(box.querySelector<HTMLInputElement>('#lp-code')?.value ?? '');
      invited = code;
      if (!name || code.length !== COOP.codeLength) {
        coop.status = !name ? 'Type your name first.' : `The room code has ${COOP.codeLength} letters.`;
        render();
        return;
      }
      busy = true;
      // A tap is a user gesture: let the sound start now.
      void audio.unlock();
      try {
        await coop.join(code, name);
        closeCoopPanel();
      } catch {
        // coop.status says why.
      }
      busy = false;
      render();
      return;
    }
    case 'copy': {
      const link = inviteLink();
      try {
        await navigator.clipboard.writeText(link);
        coop.status = 'Link copied! Send it to your friends.';
      } catch {
        coop.status = link;
      }
      render();
      return;
    }
    case 'share':
      try {
        await navigator.share({ title: 'Lembah Padi', text: `Come farm with me! Room code ${coop.code}`, url: inviteLink() });
      } catch {
        // Share sheet closed.
      }
      return;
    case 'leave':
      if (coop.isGuest) {
        // Back to this player's own saved farm.
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.location.replace(url.toString());
        return;
      }
      coop.leave();
      render();
      return;
  }
}

function install(): void {
  if (root) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.className = 'lp-coop';
  box = document.createElement('div');
  box.className = 'lp-box';
  root.appendChild(box);
  document.body.appendChild(root);
  badge = document.createElement('div');
  badge.className = 'lp-coop-badge';
  badge.addEventListener('click', () => openCoopPanel());
  document.body.appendChild(badge);

  // Typing here must not walk the farmer or open menus (Phaser listens on window).
  for (const type of ['keydown', 'keyup', 'keypress'])
    root.addEventListener(type, (e) => {
      e.stopPropagation();
      if (type === 'keydown' && (e as KeyboardEvent).key === 'Escape') closeCoopPanel();
      if (type === 'keydown' && (e as KeyboardEvent).key === 'Enter') {
        const id = (e.target as HTMLElement).id;
        if (id === 'lp-code') void act('join');
        else if (id === 'lp-name' && !coop.active) void act(invited ? 'join' : 'host');
      }
    });
  // Clicks on the dark backdrop close it; clicks in the box press its buttons.
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) closeCoopPanel();
  });
  box.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b?.dataset.act && !b.disabled) void act(b.dataset.act);
  });
  bus.on(NET.changed, render);
  render();
}

export function openCoopPanel(): void {
  install();
  if (!coop.active) coop.status = '';
  render();
  root!.classList.add('lp-open');
  audio.playSfx('menuOpen', 0.8);
  const first = box.querySelector<HTMLInputElement>(invited || !savedName() ? '#lp-name' : '#lp-code');
  if (first && !('ontouchstart' in window)) first.focus();
}

export function closeCoopPanel(): void {
  if (!root?.classList.contains('lp-open')) return;
  root.classList.remove('lp-open');
  audio.playSfx('menuClose', 0.8);
  (document.activeElement as HTMLElement | null)?.blur?.();
}

/** Builds the panel, and opens it at once for an invite link (?room=CODE). */
export function installCoop(): void {
  install();
  invited = cleanCode(new URLSearchParams(window.location.search).get('room') ?? '');
  if (invited) openCoopPanel();
}
