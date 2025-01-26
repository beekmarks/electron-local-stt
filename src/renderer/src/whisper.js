// Web audio context
var context = null;

// Audio data
var audio = null;
var audio0 = null;

// The stream instance
var instance = null;

// Model name
var model_whisper = null;

var Module = {
    print: printTextarea,
    printErr: printTextarea,
    monitorRunDependencies: function(left) {}
};

// IndexedDB setup for model storage
let dbVersion = 1;
let dbName = 'whisper-voice';
let indexedDB =
    window.indexedDB ||
    window.mozIndexedDB ||
    window.webkitIndexedDB ||
    window.msIndexedDB;

async function loadWhisper(model) {
    model_whisper = model;

    const status = document.getElementById('model-whisper-status');
    const progress = document.getElementById('fetch-whisper-progress');

    status.innerHTML = 'loading model "' + model + '" ...';

    const urls = {
        'tiny-en-q5_1': {
            'url': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/models/ggml-tiny.en-q5_1.bin',
            'size_mb': 12.3,
        }
    };

    const req = urls[model];
    if (!req) {
        status.innerHTML = 'model "' + model + '" not found';
        return;
    }

    const dst = 'whisper-' + model + '.bin';
    const url = req.url;
    const size_mb = req.size_mb;

    await loadRemote(url, dst, size_mb,
        function(p) { progress.innerHTML = Math.round(100 * p) + '%'; },
        function()  { progress.innerHTML = ''; status.innerHTML = 'model loaded'; document.getElementById('start').disabled = false; },
        function()  { progress.innerHTML = ''; status.innerHTML = 'model canceled'; },
        function(s) { progress.innerHTML = ''; status.innerHTML = s; }
    );
}

function stopRecording() {
    if (instance) {
        instance.stop();
        instance = null;
    }

    document.getElementById('state-status').innerHTML = "stopped";
    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
}

function startRecording() {
    if (!model_whisper) {
        alert('Please load a model first');
        return;
    }

    if (instance) {
        instance.stop();
    }

    document.getElementById('state-status').innerHTML = "starting...";
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function(stream) {
            context = new AudioContext({
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: false,
                autoGainControl: true,
                noiseSuppression: true,
            });

            const source = context.createMediaStreamSource(stream);
            const processor = context.createScriptProcessor(4096, 1, 1);

            source.connect(processor);
            processor.connect(context.destination);

            let chunks = [];
            let totalSamples = 0;

            processor.onaudioprocess = function(e) {
                const inputData = e.inputBuffer.getChannelData(0);
                chunks.push(new Float32Array(inputData));
                totalSamples += inputData.length;

                // Process audio in chunks (e.g., every 30 seconds)
                if (totalSamples >= 16000 * 30) {
                    const audioData = new Float32Array(totalSamples);
                    let offset = 0;
                    for (let chunk of chunks) {
                        audioData.set(chunk, offset);
                        offset += chunk.length;
                    }

                    // Convert to 16-bit PCM
                    const audioBuffer = convertTypedArray(audioData, Int16Array);
                    
                    // Process audio with Whisper
                    Module.processAudio(audioBuffer);

                    // Reset chunks and total samples
                    chunks = [];
                    totalSamples = 0;
                }
            };

            instance = {
                processor: processor,
                stream: stream,
                stop: function() {
                    this.processor.disconnect();
                    this.stream.getTracks().forEach(track => track.stop());
                }
            };

            document.getElementById('state-status').innerHTML = "recording...";
        })
        .catch(function(err) {
            console.error('Error accessing microphone:', err);
            document.getElementById('state-status').innerHTML = "error: " + err.message;
            document.getElementById('start').disabled = false;
            document.getElementById('stop').disabled = true;
        });
}

function onStart() {
    startRecording();
}

function onStop() {
    stopRecording();
}

// Automatically download smallest quantized model
loadWhisper('tiny-en-q5_1');
