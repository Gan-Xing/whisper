// app/components/SettingsDialog.tsx
import React from "react";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

interface SettingsDialogProps {
  dictionary: any;
  settingsOpen: boolean;
  handleSettingsClose: () => void;
  model: string;
  handleModelChange: (event: SelectChangeEvent) => void;
  operation: string;
  handleOperationChange: (event: SelectChangeEvent) => void;
  inputLanguage: string;
  handleInputLanguageChange: (event: SelectChangeEvent) => void;
  outputLanguage: string;
  handleOutputLanguageChange: (event: SelectChangeEvent) => void;
  selectedVoice: SpeechSynthesisVoice | null;
  voices: SpeechSynthesisVoice[];
  handleVoiceChange: (event: SelectChangeEvent) => void;
  models: string[];
  langOptions: string[];
  translatedLanguageOptions: any;
  largeV3LanguagesKeys: string[];
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  dictionary,
  settingsOpen,
  handleSettingsClose,
  model,
  handleModelChange,
  operation,
  handleOperationChange,
  inputLanguage,
  handleInputLanguageChange,
  outputLanguage,
  handleOutputLanguageChange,
  selectedVoice,
  voices,
  handleVoiceChange,
  models,
  langOptions,
  translatedLanguageOptions,
  largeV3LanguagesKeys,
}) => (
  <Dialog open={settingsOpen} onClose={handleSettingsClose}>
    <DialogTitle>{dictionary.settings}</DialogTitle>
    <DialogContent sx={{ pt: "16px !important" }}>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="operation-select-label">
          {dictionary.operationType}
        </InputLabel>
        <Select
          labelId="operation-select-label"
          value={operation}
          onChange={handleOperationChange}
        >
          <MenuItem value="transcription">{dictionary.transcription}</MenuItem>
          <MenuItem value="translation">{dictionary.translation}</MenuItem>
          <MenuItem value="conversation">{dictionary.conversation}</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="model-select-label">{dictionary.modelLabel}</InputLabel>
        <Select
          labelId="model-select-label"
          value={model}
          onChange={handleModelChange}
        >
          {models.map((model) => (
            <MenuItem key={model} value={model}>
              {model}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="input-language-select-label">
          {dictionary.inputLanguage}
        </InputLabel>
        <Select
          labelId="input-language-select-label"
          value={inputLanguage}
          onChange={handleInputLanguageChange}
        >
          {langOptions &&
            langOptions.map((lang) => (
              <MenuItem key={lang} value={lang}>
                {translatedLanguageOptions[lang]}
              </MenuItem>
            ))}
        </Select>
      </FormControl>
      {(operation === "translation" || operation === "conversation") && (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="output-language-select-label">
              {dictionary.outputLanguage}
            </InputLabel>
            <Select
              labelId="output-language-select-label"
              value={outputLanguage}
              onChange={handleOutputLanguageChange}
            >
              {largeV3LanguagesKeys &&
                largeV3LanguagesKeys.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {translatedLanguageOptions[lang]}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="voice-select-label">
              {dictionary.voiceSelect}
            </InputLabel>
            <Select
              labelId="voice-select-label"
              value={selectedVoice ? selectedVoice.voiceURI : ""}
              onChange={handleVoiceChange}
            >
              {voices
                .filter((voice) => voice.lang.startsWith(outputLanguage))
                .map((voice) => (
                  <MenuItem key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={handleSettingsClose} color="primary">
        {dictionary.close}
      </Button>
    </DialogActions>
  </Dialog>
);

export default SettingsDialog;
