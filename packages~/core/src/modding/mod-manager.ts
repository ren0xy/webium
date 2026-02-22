import type { ModManifest } from "./manifest-parser.js";

/**
 * Manages mod loading, unloading, enabling, and disabling.
 * @see Requirements 11.5
 */
export interface IModManager {
  loadMod(manifest: ModManifest): void;
  unloadMod(modId: string): void;
  enableMod(modId: string): void;
  disableMod(modId: string): void;
  isLoaded(modId: string): boolean;
  isEnabled(modId: string): boolean;
}

interface ModEntry {
  manifest: ModManifest;
  enabled: boolean;
}

export class ModManager implements IModManager {
  private readonly _mods = new Map<string, ModEntry>();

  loadMod(manifest: ModManifest): void {
    if (!manifest.id) throw new Error("Mod manifest must have an id");
    if (this._mods.has(manifest.id)) {
      throw new Error(`Mod "${manifest.id}" is already loaded`);
    }
    this._mods.set(manifest.id, { manifest, enabled: true });
  }

  unloadMod(modId: string): void {
    if (!this._mods.has(modId)) {
      throw new Error(`Mod "${modId}" is not loaded`);
    }
    this._mods.delete(modId);
  }

  enableMod(modId: string): void {
    const entry = this._mods.get(modId);
    if (!entry) throw new Error(`Mod "${modId}" is not loaded`);
    entry.enabled = true;
  }

  disableMod(modId: string): void {
    const entry = this._mods.get(modId);
    if (!entry) throw new Error(`Mod "${modId}" is not loaded`);
    entry.enabled = false;
  }

  isLoaded(modId: string): boolean {
    return this._mods.has(modId);
  }

  isEnabled(modId: string): boolean {
    return this._mods.get(modId)?.enabled ?? false;
  }
}
