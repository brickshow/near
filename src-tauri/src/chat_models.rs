use serde::Deserialize;
use serde_json::Value;

#[derive(Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReplyMode {
    #[default]
    Chat,
    Voice,
}

#[derive(Clone)]
pub struct ModelChoice {
    pub slug: String,
    pub reasoning_effort: Option<String>,
}

#[derive(Clone)]
pub struct ModelChoices {
    chat: ModelChoice,
    voice: ModelChoice,
}

impl ModelChoices {
    pub fn from_catalog(catalog: &Value) -> Result<Self, String> {
        let models = catalog["models"].as_array().ok_or("Invalid ChatGPT model catalog")?;
        let available = |model: &&Value| model["visibility"] == "list"
            && model["supported_in_api"] != false
            && model["slug"].as_str().is_some_and(|slug| !slug.is_empty());
        let default = models.iter().find(available).ok_or("No model is available for this ChatGPT account")?;
        let voice = ["gpt-6-luna", "gpt-5.6-luna"].into_iter()
            .find_map(|slug| models.iter().filter(available).find(|model| model["slug"] == slug))
            .unwrap_or(default);
        let low_supported = voice["supported_reasoning_levels"].as_array()
            .is_some_and(|levels| levels.iter().any(|level| level["effort"] == "low"));
        // The Responses API supports `none` on GPT-6 Luna even though the
        // ChatGPT catalog lists only its reasoning modes. Verified with live
        // requests; other models use only their advertised settings.
        // https://developers.openai.com/api/docs/guides/latest-model
        let voice_effort = if voice["slug"] == "gpt-6-luna" {
            Some("none".into())
        } else {
            low_supported.then(|| "low".into())
        };
        Ok(Self {
            chat: ModelChoice { slug: default["slug"].as_str().unwrap().into(), reasoning_effort: None },
            voice: ModelChoice { slug: voice["slug"].as_str().unwrap().into(), reasoning_effort: voice_effort },
        })
    }

    pub fn for_mode(&self, mode: ReplyMode) -> ModelChoice {
        match mode { ReplyMode::Chat => self.chat.clone(), ReplyMode::Voice => self.voice.clone() }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn voice_uses_available_fast_model_and_supported_effort() {
        let choices = ModelChoices::from_catalog(&json!({"models": [
            {"slug":"gpt-6.1-sol", "visibility":"list", "supported_in_api":true},
            {"slug":"gpt-6-luna", "visibility":"list", "supported_in_api":true, "supported_reasoning_levels":[{"effort":"low"}]}
        ]})).unwrap();
        assert_eq!(choices.for_mode(ReplyMode::Chat).slug, "gpt-6.1-sol");
        let voice = choices.for_mode(ReplyMode::Voice);
        assert_eq!(voice.slug, "gpt-6-luna");
        assert_eq!(voice.reasoning_effort.as_deref(), Some("none"));
    }

    #[test]
    fn hidden_or_unavailable_fast_models_fall_back_without_guessing_effort() {
        let choices = ModelChoices::from_catalog(&json!({"models": [
            {"slug":"gpt-6-luna", "visibility":"hide", "supported_in_api":true},
            {"slug":"gpt-5.6-luna", "visibility":"list", "supported_in_api":false},
            {"slug":"available-model", "visibility":"list"}
        ]})).unwrap();
        let voice = choices.for_mode(ReplyMode::Voice);
        assert_eq!(voice.slug, "available-model");
        assert!(voice.reasoning_effort.is_none());
    }

    #[test]
    fn empty_catalog_is_an_error() {
        assert!(ModelChoices::from_catalog(&json!({"models":[]})).is_err());
        assert!(ModelChoices::from_catalog(&json!({})).is_err());
    }
}
