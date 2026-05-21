class FakeStreamSource {
    connect() {
        return this;
    }
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
}
