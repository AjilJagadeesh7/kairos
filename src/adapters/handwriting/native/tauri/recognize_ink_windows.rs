//! Windows Ink handwriting recognition for the Tauri `recognize_ink` command.
//!
//! Drop this into `src-tauri/src/` and call `recognize_ink_windows(..)` from the
//! `recognize_ink` command in `lib.rs` (guarded by `#[cfg(windows)]`). See
//! ../README.md for the required `windows` crate Cargo.toml entry.

#![cfg(windows)]

use windows::{
    core::HSTRING,
    Foundation::Point,
    UI::Input::Inking::{InkStroke, InkStrokeBuilder},
    UI::Input::Inking::Analysis::{InkAnalyzer, InkAnalysisResultKind},
};

#[derive(serde::Deserialize)]
pub struct IpcStroke {
    pub x: Vec<f64>,
    pub y: Vec<f64>,
}

/// True when the on-device handwriting recognizer can run.
pub fn recognize_ink_available() -> bool {
    // InkAnalyzer is present on all supported Windows 10/11 desktop SKUs.
    InkAnalyzer::new().is_ok()
}

/// Recognize ink strokes to text using InkAnalyzer.
pub fn recognize_ink_windows(strokes: Vec<IpcStroke>) -> Result<String, String> {
    let analyzer = InkAnalyzer::new().map_err(|e| e.to_string())?;
    let builder = InkStrokeBuilder::new().map_err(|e| e.to_string())?;

    for s in &strokes {
        let points: Vec<Point> = s
            .x
            .iter()
            .zip(s.y.iter())
            .map(|(&x, &y)| Point { X: x as f32, Y: y as f32 })
            .collect();
        let stroke: InkStroke = builder
            .CreateStroke(&windows::core::Array::<Point>::from_slice(&points))
            .map_err(|e| e.to_string())?;
        analyzer.AddDataForStroke(&stroke).map_err(|e| e.to_string())?;
    }

    let result = analyzer.AnalyzeAsync().map_err(|e| e.to_string())?
        .get().map_err(|e| e.to_string())?;

    if result.Status().map_err(|e| e.to_string())? == InkAnalysisResultKind::Updated {
        // Pull the recognized text off the root analysis node.
        let root = analyzer.AnalysisRoot().map_err(|e| e.to_string())?;
        let text: HSTRING = root.RecognizedText().map_err(|e| e.to_string())?;
        Ok(text.to_string())
    } else {
        Ok(String::new())
    }
}
