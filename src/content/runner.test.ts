import { fakeBrowser } from '@webext-core/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeature } from '../shared/settings';
import { ext } from '../shared/ext';
import { startRunner } from './runner';

const registry = [
  { id: 'alpha', default: true },
  { id: 'beta', default: false },
  { id: 'gamma', default: true },
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = () => {
  const stops = { alpha: vi.fn(), beta: vi.fn(), gamma: vi.fn() };
  const starts = {
    alpha: vi.fn(() => stops.alpha),
    beta: vi.fn(() => stops.beta),
    gamma: vi.fn(() => stops.gamma),
  };
  return { stops, starts };
};

describe('startRunner', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
  });

  it('starts the features enabled by default', async () => {
    const { starts } = setup();
    startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.alpha).toHaveBeenCalledOnce());
    expect(starts.gamma).toHaveBeenCalledOnce();
    expect(starts.beta).not.toHaveBeenCalled();
  });

  it('respects the stored settings', async () => {
    await setFeature('alpha', false);
    await setFeature('beta', true);
    const { starts } = setup();
    startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.beta).toHaveBeenCalledOnce());
    expect(starts.alpha).not.toHaveBeenCalled();
    expect(starts.gamma).toHaveBeenCalledOnce();
  });

  it('stops a feature disabled live and starts one enabled live', async () => {
    const { starts, stops } = setup();
    startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.alpha).toHaveBeenCalled());
    await setFeature('alpha', false);
    await vi.waitFor(() => expect(stops.alpha).toHaveBeenCalledOnce());
    await setFeature('beta', true);
    await vi.waitFor(() => expect(starts.beta).toHaveBeenCalledOnce());
  });

  it('ignores a repeated enable or disable', async () => {
    const { starts, stops } = setup();
    startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.alpha).toHaveBeenCalled());
    await setFeature('alpha', true);
    await setFeature('beta', false);
    await setFeature('alpha', false);
    await vi.waitFor(() => expect(stops.alpha).toHaveBeenCalledOnce());
    await setFeature('alpha', false);
    await setFeature('gamma', true);
    await vi.waitFor(() => expect(ext.storage.local.get('settings')).resolves.toBeTruthy());
    expect(starts.alpha).toHaveBeenCalledOnce();
    expect(starts.beta).not.toHaveBeenCalled();
    expect(stops.alpha).toHaveBeenCalledOnce();
    expect(stops.beta).not.toHaveBeenCalled();
    expect(starts.gamma).toHaveBeenCalledOnce();
  });

  it('logs a throwing start and still starts the others', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boom = new Error('boom');
    const { starts } = setup();
    starts.alpha.mockImplementation(() => {
      throw boom;
    });
    startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.gamma).toHaveBeenCalledOnce());
    expect(error).toHaveBeenCalledWith('[Palimpseste] alpha', boom);
  });

  it('logs a throwing stop and still stops the others', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boom = new Error('boom');
    const { starts, stops } = setup();
    stops.alpha.mockImplementation(() => {
      throw boom;
    });
    const stop = startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.gamma).toHaveBeenCalled());
    stop();
    expect(stops.gamma).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith('[Palimpseste] alpha', boom);
  });

  it('applies the defaults when the storage is cleared', async () => {
    await setFeature('alpha', false);
    await setFeature('beta', true);
    const { starts, stops } = setup();
    startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.beta).toHaveBeenCalledOnce());
    await ext.storage.local.clear();
    await vi.waitFor(() => expect(stops.beta).toHaveBeenCalledOnce());
    expect(starts.alpha).toHaveBeenCalledOnce();
  });

  it('stops every feature and unsubscribes when the returned function is called', async () => {
    const { starts, stops } = setup();
    const stop = startRunner(registry, starts);
    await vi.waitFor(() => expect(starts.gamma).toHaveBeenCalled());
    stop();
    expect(stops.alpha).toHaveBeenCalledOnce();
    expect(stops.gamma).toHaveBeenCalledOnce();
    await setFeature('beta', true);
    expect(starts.beta).not.toHaveBeenCalled();
  });

  describe('with a slow initial read', () => {
    const slowRead = () => {
      let resolve!: (value: Record<string, unknown>) => void;
      const pending = new Promise<Record<string, unknown>>((r) => (resolve = r));
      vi.spyOn(ext.storage.local, 'get').mockReturnValueOnce(pending as never);
      return resolve;
    };

    it('does not apply a read older than a change event', async () => {
      const resolve = slowRead();
      const { starts, stops } = setup();
      startRunner(registry, starts);
      await ext.storage.local.set({
        settings: { version: 1, features: { alpha: false, beta: true } },
      });
      await vi.waitFor(() => expect(starts.beta).toHaveBeenCalledOnce());
      resolve({});
      await flush();
      expect(starts.alpha).not.toHaveBeenCalled();
      expect(stops.beta).not.toHaveBeenCalled();
    });

    it('starts nothing when stopped before the read resolves', async () => {
      const resolve = slowRead();
      const { starts } = setup();
      const stop = startRunner(registry, starts);
      stop();
      resolve({});
      await flush();
      expect(starts.alpha).not.toHaveBeenCalled();
      expect(starts.gamma).not.toHaveBeenCalled();
    });
  });

  it('is inert with an empty registry', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stop = startRunner([], {});
    await setFeature('alpha', true);
    expect(() => stop()).not.toThrow();
    expect(error).not.toHaveBeenCalled();
  });
});
