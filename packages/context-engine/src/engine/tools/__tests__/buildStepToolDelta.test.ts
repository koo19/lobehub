import { describe, expect, it } from 'vitest';

import { buildStepToolDelta } from '../buildStepToolDelta';
import type { LobeToolManifest } from '../types';

const mockLocalSystemManifest: LobeToolManifest = {
  api: [
    {
      description: 'Run command',
      name: 'run_command',
      parameters: { properties: {}, type: 'object' },
    },
  ],
  identifier: 'local-system',
  meta: { title: 'Local System' },
  type: 'builtin',
};

const mockSearchManifest: LobeToolManifest = {
  api: [
    {
      description: 'Search',
      name: 'search',
      parameters: { properties: {}, type: 'object' },
    },
  ],
  identifier: 'web-search',
  meta: { title: 'Web Search' },
  type: 'builtin',
};

describe('buildStepToolDelta', () => {
  describe('device activation', () => {
    it('should activate local-system when device is active and not in operation set', () => {
      const delta = buildStepToolDelta({
        activeDeviceId: 'device-123',
        localSystemManifest: mockLocalSystemManifest,
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(1);
      expect(delta.activatedTools[0]).toEqual({
        id: 'local-system',
        manifest: mockLocalSystemManifest,
        source: 'device',
      });
    });

    it('should not activate local-system when already in operation set', () => {
      const delta = buildStepToolDelta({
        activeDeviceId: 'device-123',
        localSystemManifest: mockLocalSystemManifest,
        operationManifestMap: { 'local-system': mockLocalSystemManifest },
      });

      expect(delta.activatedTools).toHaveLength(0);
    });

    it('should not activate when no activeDeviceId', () => {
      const delta = buildStepToolDelta({
        localSystemManifest: mockLocalSystemManifest,
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(0);
    });

    it('should not activate when no localSystemManifest', () => {
      const delta = buildStepToolDelta({
        activeDeviceId: 'device-123',
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(0);
    });
  });

  describe('mentioned tools', () => {
    it('should add mentioned tools not in operation set', () => {
      const delta = buildStepToolDelta({
        mentionedToolIds: ['tool-a', 'tool-b'],
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(2);
      expect(delta.activatedTools[0]).toEqual({ id: 'tool-a', source: 'mention' });
      expect(delta.activatedTools[1]).toEqual({ id: 'tool-b', source: 'mention' });
    });

    it('should skip mentioned tools already in operation set', () => {
      const delta = buildStepToolDelta({
        mentionedToolIds: ['web-search', 'tool-a'],
        operationManifestMap: { 'web-search': mockSearchManifest },
      });

      expect(delta.activatedTools).toHaveLength(1);
      expect(delta.activatedTools[0].id).toBe('tool-a');
    });

    it('should handle empty mentionedToolIds', () => {
      const delta = buildStepToolDelta({
        mentionedToolIds: [],
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(0);
    });
  });

  describe('forceFinish', () => {
    it('should set deactivatedToolIds to wildcard when forceFinish is true', () => {
      const delta = buildStepToolDelta({
        forceFinish: true,
        operationManifestMap: {},
      });

      expect(delta.deactivatedToolIds).toEqual(['*']);
    });

    it('should not set deactivatedToolIds when forceFinish is false', () => {
      const delta = buildStepToolDelta({
        forceFinish: false,
        operationManifestMap: {},
      });

      expect(delta.deactivatedToolIds).toBeUndefined();
    });
  });

  describe('activated tools (lobe-tools / lobe-skills)', () => {
    it('should activate tools with manifest from allManifestMap', () => {
      const delta = buildStepToolDelta({
        activatedToolIds: ['web-search'],
        allManifestMap: { 'web-search': mockSearchManifest },
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(1);
      expect(delta.activatedTools[0]).toEqual({
        id: 'web-search',
        manifest: mockSearchManifest,
        source: 'active_tools',
      });
    });

    it('should skip tools already in operation set', () => {
      const delta = buildStepToolDelta({
        activatedToolIds: ['web-search'],
        allManifestMap: { 'web-search': mockSearchManifest },
        operationManifestMap: { 'web-search': mockSearchManifest },
      });

      expect(delta.activatedTools).toHaveLength(0);
    });

    it('should skip tools not found in allManifestMap', () => {
      const delta = buildStepToolDelta({
        activatedToolIds: ['unknown-tool'],
        allManifestMap: { 'web-search': mockSearchManifest },
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(0);
    });

    it('should not activate when allManifestMap is not provided', () => {
      const delta = buildStepToolDelta({
        activatedToolIds: ['web-search'],
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(0);
    });

    it('should handle empty activatedToolIds', () => {
      const delta = buildStepToolDelta({
        activatedToolIds: [],
        allManifestMap: { 'web-search': mockSearchManifest },
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(0);
    });
  });

  describe('combined signals', () => {
    it('should handle device + mentions + forceFinish together', () => {
      const delta = buildStepToolDelta({
        activeDeviceId: 'device-123',
        forceFinish: true,
        localSystemManifest: mockLocalSystemManifest,
        mentionedToolIds: ['tool-a'],
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(2); // local-system + tool-a
      expect(delta.deactivatedToolIds).toEqual(['*']);
    });

    it('should handle device + mentions + activated tools together', () => {
      const delta = buildStepToolDelta({
        activatedToolIds: ['web-search'],
        activeDeviceId: 'device-123',
        allManifestMap: { 'web-search': mockSearchManifest },
        localSystemManifest: mockLocalSystemManifest,
        mentionedToolIds: ['tool-a'],
        operationManifestMap: {},
      });

      // local-system + tool-a (mention) + web-search (active_tools)
      expect(delta.activatedTools).toHaveLength(3);
      expect(delta.activatedTools.map((t) => t.source)).toEqual([
        'device',
        'mention',
        'active_tools',
      ]);
    });

    it('should return empty delta when no signals', () => {
      const delta = buildStepToolDelta({
        operationManifestMap: {},
      });

      expect(delta.activatedTools).toHaveLength(0);
      expect(delta.deactivatedToolIds).toBeUndefined();
    });
  });
});
