// Compiled by benchmark-transcription.ps1 against the app's built dependencies.
#[path = "../src-tauri/src/transcription_engine.rs"]
mod transcription_engine;
use std::time::Instant;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let mut wav = hound::WavReader::open(&args[2])?;
    let sample_rate = wav.spec().sample_rate as usize;
    assert_eq!(wav.spec().channels, 1);
    let input: Vec<f32> = wav.samples::<i16>().map(|v| v.unwrap() as f32 / 32768.0).collect();
    let samples: Vec<f32> = (0..input.len() * 16_000 / sample_rate).map(|i| {
        let position = i as f32 * sample_rate as f32 / 16_000.0;
        let index = position as usize;
        let fraction = position - index as f32;
        input[index] * (1.0 - fraction) + input[(index + 1).min(input.len() - 1)] * fraction
    }).collect();
    let started = Instant::now();
    let mut state = transcription_engine::load_state(std::path::Path::new(&args[1]))?;
    println!("model_prepare_ms={}", started.elapsed().as_millis());
    let mut times = Vec::new();
    for round in 0..2 {
        let mut transcript = String::new();
        for (window, offset) in (0..samples.len()).step_by(24_000).enumerate() {
            let audio = &samples[offset..samples.len().min(offset + 32_000)];
            if round > 0 && audio.len() < 8_000 { continue; }
            let started = Instant::now();
            let text = transcription_engine::transcribe(&mut state, audio)?;
            let ms = started.elapsed().as_millis();
            println!("round={round} window={window} audio_ms={} elapsed_ms={ms} text={text:?}", audio.len() * 1000 / 16_000);
            transcript.push_str(&text.to_lowercase());
            transcript.push(' ');
            times.push(ms);
        }
        if args.iter().any(|arg| arg == "--fixture") {
            for phrase in ["what is the verse of the day", "please help me find", "some peace today"] {
                if !transcript.contains(phrase) { return Err(format!("Missing fixture speech: {phrase}").into()); }
            }
        }
    }
    times.sort();
    let median = times[times.len() / 2];
    let mean = times.iter().sum::<u128>() / times.len() as u128;
    println!("median_ms={median} mean_ms={mean} max_ms={} window_arrival_ms=1500", times.last().unwrap());
    if mean > 1500 { return Err("Transcription cannot keep up with incoming audio (mean exceeds 1500 ms)".into()); }
    Ok(())
}
