import {
  Room,
  RoomEvent,
  Track,
  LocalAudioTrack,
  LocalVideoTrack,
} from 'livekit-client';

/**
 * LiveKit SFU session: one uplink, N downlinks (groups).
 * Signaling remains for presence; media goes through LiveKit when configured.
 */
export class SfuCallSession {
  constructor() {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    this.remoteStreams = new Map();
    this.onRemoteStream = null;
    this.onConnectionEvent = null;
    this.published = [];
    this.disposed = false;

    this.room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      this.attachRemoteTrack(participant.identity, track);
    });
    this.room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
      this.detachRemoteTrack(participant.identity, track);
    });
    this.room.on(RoomEvent.ParticipantDisconnected, (p) => {
      this.remoteStreams.delete(p.identity);
      this.onRemoteStream?.(p.identity, new MediaStream());
    });
    if (RoomEvent.Reconnecting) {
      this.room.on(RoomEvent.Reconnecting, () => this.onConnectionEvent?.('reconnecting'));
    }
    if (RoomEvent.Reconnected) {
      this.room.on(RoomEvent.Reconnected, () => this.onConnectionEvent?.('reconnected'));
    }
    if (RoomEvent.Disconnected) {
      this.room.on(RoomEvent.Disconnected, () => {
        if (this.disposed) return;
        this.onConnectionEvent?.('disconnected');
      });
    }
  }

  setConnectionHandler(fn) {
    this.onConnectionEvent = fn;
  }

  async connect(url, token, localStream, onRemoteStream) {
    this.onRemoteStream = onRemoteStream;
    await this.room.connect(url, token);

    for (const p of this.room.remoteParticipants.values()) {
      this.syncParticipant(p);
    }

    if (localStream) {
      await this.publishLocal(localStream);
    }
  }

  syncParticipant(p) {
    p.trackPublications.forEach((pub) => {
      if (pub.track) this.attachRemoteTrack(p.identity, pub.track);
    });
  }

  attachRemoteTrack(id, track) {
    if (track.kind !== Track.Kind.Audio && track.kind !== Track.Kind.Video) return;
    let ms = this.remoteStreams.get(id);
    if (!ms) {
      ms = new MediaStream();
      this.remoteStreams.set(id, ms);
    }
    const media = track.mediaStreamTrack;
    if (!ms.getTracks().some((t) => t.id === media.id)) {
      ms.addTrack(media);
    }
    this.onRemoteStream?.(id, ms);
  }

  detachRemoteTrack(id, track) {
    const ms = this.remoteStreams.get(id);
    if (!ms) return;
    const media = track.mediaStreamTrack;
    try {
      ms.removeTrack(media);
    } catch {
      /* ignore */
    }
    this.onRemoteStream?.(id, ms);
  }

  async publishLocal(stream) {
    await this.unpublishLocal();
    const audio = stream.getAudioTracks()[0];
    const video = stream.getVideoTracks()[0];
    if (audio) {
      const t = new LocalAudioTrack(audio);
      await this.room.localParticipant.publishTrack(t);
      this.published.push(t);
    }
    if (video) {
      const t = new LocalVideoTrack(video);
      await this.room.localParticipant.publishTrack(t);
      this.published.push(t);
    }
  }

  async setLocalStream(stream) {
    if (!stream) {
      await this.unpublishLocal();
      return;
    }
    await this.publishLocal(stream);
  }

  async replaceVideoTrack(track) {
    const pubs = [...this.room.localParticipant.videoTrackPublications.values()];
    const pub = pubs[0];
    if (pub?.track && track) {
      await pub.track.replaceTrack(track);
      return;
    }
    if (track) {
      const lt = new LocalVideoTrack(track);
      await this.room.localParticipant.publishTrack(lt);
      this.published.push(lt);
    }
  }

  async replaceAudioTrack(track) {
    const pubs = [...this.room.localParticipant.audioTrackPublications.values()];
    const pub = pubs[0];
    if (pub?.track && track) {
      await pub.track.replaceTrack(track);
      return;
    }
    if (track) {
      const lt = new LocalAudioTrack(track);
      await this.room.localParticipant.publishTrack(lt);
      this.published.push(lt);
    }
  }

  async unpublishLocal() {
    for (const t of this.published) {
      try {
        await this.room.localParticipant.unpublishTrack(t);
      } catch {
        /* ignore */
      }
    }
    this.published = [];
  }

  dispose() {
    this.disposed = true;
    this.onConnectionEvent = null;
    void this.unpublishLocal();
    try {
      this.room.disconnect();
    } catch {
      /* ignore */
    }
    this.remoteStreams.clear();
    this.onRemoteStream = null;
  }
}
