/**
 * Routes the capture mic through a GainNode so the user can boost/cut sensitivity
 * before the track is published to peers.
 */
export class LocalAudioProcessor {
  constructor() {
    this.ctx = null;
    this.gain = null;
    this.source = null;
    this.dest = null;
  }

  async attach(audioTrack, _gainValue = 1) {
    this.detach();
    // Never route the mic through Web Audio: a GainNode destination track
    // disables browser AEC. Output boost belongs on playback, not capture.
    return audioTrack || null;
  }

  setGain(value) {
    if (this.gain) {
      this.gain.gain.value = value;
    }
  }

  detach() {
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.gain?.disconnect();
    } catch {
      /* ignore */
    }
    if (this.ctx) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.gain = null;
    this.source = null;
    this.dest = null;
  }
}
