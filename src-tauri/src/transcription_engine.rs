use std::path::Path;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState};

fn parameters(sample_count: usize) -> FullParams<'static, 'static> {
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(None);
    params.set_n_threads(4);
    // Live capture sends at most two seconds. A 512-frame encoder context
    // covers 10.24 seconds, including padding, instead of encoding 30 seconds
    // for every window. Keep the full context for longer imported audio.
    if sample_count <= 5 * 16_000 { params.set_audio_ctx(512); }
    params.set_no_timestamps(true);
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params
}

pub fn load_state(path: &Path) -> Result<WhisperState, String> {
    // Errors are returned through Result; token-by-token native debug output
    // should not flood the terminal while the user is recording.
    whisper_rs::install_logging_hooks();
    let context = WhisperContext::new_with_params(path, WhisperContextParameters::default())
        .map_err(|e| format!("Could not load the offline speech model: {e}"))?;
    let mut state = context.create_state()
        .map_err(|e| format!("Could not start speech recognition: {e}"))?;
    // whisper.cpp detects language before applying audio_ctx. Prime the short
    // context once, before the microphone starts, so the first spoken window
    // does not pay for a full 30-second language-detection encode.
    let silence = [0.0; 1_600];
    let mut warmup = parameters(silence.len());
    warmup.set_language(Some("en"));
    warmup.set_max_tokens(1);
    warmup.set_temperature_inc(0.0);
    state.full(warmup, &silence).map_err(|e| format!("Could not prepare speech recognition: {e}"))?;
    Ok(state)
}

pub fn transcribe(state: &mut WhisperState, samples: &[f32]) -> Result<String, String> {
    let params = parameters(samples.len());
    state.full(params, samples).map_err(|e| format!("Speech recognition failed: {e}"))?;
    Ok(state.as_iter().map(|segment| segment.to_string()).collect::<Vec<_>>().join(" ").trim().to_string())
}
