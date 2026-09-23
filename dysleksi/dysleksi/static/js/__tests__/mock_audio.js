class FakeStreamSource {
    connect() {
        return this;
    }
    disconnect() {}
}

class FakeAnalyser {
    getByteTimeDomainData() {}
}

export class MockAudioContext {
    createMediaStreamSource() {
        return new FakeStreamSource();
    }
    createAnalyser() {
        return new FakeAnalyser();
    }
    close() {}
}
