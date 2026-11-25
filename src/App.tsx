import { ChurchCalendarWindow } from "./pages/notes/ChurchCalendarWindow";
import { FaithJourneyWindow } from "./pages/faith/FaithJourneyWindow";
import { openDockedWindow } from "./lib/dockedWindow";
import { NotesWindow } from "./pages/notes/NotesWindow";
import { useEventReminders } from "./hooks/useEventReminders";
import { useFaithReminders } from "./hooks/useFaithReminders";
import { BibleWindow } from "./pages/bible/BibleWindow";
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getAllWebviewWindows, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { openUrl } from "@tauri-apps/plugin-opener";
import { NotchHeader } from "./components/NotchHeader";
import { PageProgress } from "./components/PageProgress";
import { NotchFrame } from "./components/NotchFrame";
import { AppModal, type AppModalContent } from "./components/AppModal";
import { createPortal } from "react-dom";
import { CollapsedEyes } from "./components/CollapsedEyes";
import { useNotchWindow } from "./hooks/useNotchWindow";
import { SplashPage } from "./pages/splash/SplashPage";
import { WelcomePage } from "./pages/welcome/WelcomePage";
import { LocalDataPage } from "./pages/local-data/LocalDataPage";
import {
  ChooseAgentPage,
  type AgentChoice,
} from "./pages/choose-agent/ChooseAgentPage";
import { AgentFoundPage } from "./pages/agent-found/AgentFoundPage";
import { AgentMissingPage } from "./pages/agent-missing/AgentMissingPage";
import { SetupGuidePage } from "./pages/setup-guide/SetupGuidePage";
import { HomePage } from "./pages/home/HomePage";
import { SettingsWindow } from "./pages/home/SettingsWindow";
import { loadReminderPreferences } from "./lib/reminderPreferences";
import type { HomeSection } from "./components/HomeNavigation";
import { DailyVersePage } from "./pages/home/DailyVersePage";
import { ReminderPreviewPage } from "./pages/home/ReminderPreviewPage";
import { QuietModePage } from "./pages/home/QuietModePage";
import { ListeningPage } from "./pages/conversation/ListeningPage";
import { UnderstandingRequestPage } from "./pages/conversation/UnderstandingRequestPage";
import { RunningActionsPage } from "./pages/conversation/RunningActionsPage";
import { SpeakingResponsePage } from "./pages/conversation/SpeakingResponsePage";
import { TypeMessagePage } from "./pages/conversation/TypeMessagePage";
import { ChatWindow } from "./pages/chat/ChatWindow";
import { ConversationHistoryPage } from "./pages/conversation/ConversationHistoryPage";
import { ReviewChangePage } from "./pages/recovery/ReviewChangePage";
import { PartialSuccessPage } from "./pages/recovery/PartialSuccessPage";
import { AgentUnavailablePage } from "./pages/recovery/AgentUnavailablePage";
import { SignInExpiredPage } from "./pages/recovery/SignInExpiredPage";
import { UsageLimitPage } from "./pages/recovery/UsageLimitPage";
import { RequestStoppedPage } from "./pages/recovery/RequestStoppedPage";
import { TestingConnectionPage } from "./pages/voice-setup/TestingConnectionPage";
import { MicrophoneChoicePage } from "./pages/voice-setup/MicrophoneChoicePage";
import { LocalVoiceSetupPage } from "./pages/voice-setup/LocalVoiceSetupPage";
import { TestVoicePage } from "./pages/voice-setup/TestVoicePage";
import { BibleSetupPage } from "./pages/voice-setup/BibleSetupPage";
import { VoiceSettingsPage } from "./pages/voice-setup/VoiceSettingsPage";
import { FinishSetupPage } from "./pages/voice-setup/FinishSetupPage";
import { NEAR_VOICE_KEY, stopNearVoice, type NearSpeechStream } from "./lib/voice";
import { sendChat, type ChatTurn } from "./lib/chat";
import { friendlyChatGptError } from "./lib/chatgptErrors";
import { COLLAPSE_DELAY_KEY, loadCollapseDelaySeconds } from "./lib/notchPreferences";
import { localTranscription, type TranscriptionSession } from "./lib/transcription";

type Page =
  | "splash"
  | "intro-splash"
  | "welcome"
  | "local-data"
  | "choose-agent"
  | "agent-found"
  | "agent-missing"
  | "setup-guide"
  | "testing-connection"
  | "microphone-choice"
  | "local-voice-setup"
  | "test-voice"
  | "bible-setup"
  | "voice-settings"
  | "finish-setup"
  | "home"
  | "daily-verse"
  | "reminder-preview"
  | "quiet-mode"
  | "listening"
  | "understanding-request"
  | "running-actions"
  | "speaking-response"
  | "type-message"
  | "conversation-history"
  | "review-change"
  | "partial-success"
  | "agent-unavailable"
  | "sign-in-expired"
  | "usage-limit"
  | "request-stopped";
type VoiceSetupFlow = { next: "local-data" | "finish-setup" };
type ChatGptStatus = { connected: boolean; email: string | null; plan_usage_enabled: boolean; message: string };
const SETUP_COMPLETE_KEY = "near.setup.complete";
const AGENT_CHOICE_KEY = "near.agent.choice";
const AGENT_CHOICES: AgentChoice[] = ["ChatGPT", "Claude Code", "Local model"];

function App() {
  const windowKind = new URLSearchParams(window.location.search).get("window");
  const isChatWindow = windowKind === "chat" || windowKind === "bible" || windowKind === "notes" || windowKind === "church" || windowKind === "settings" || windowKind === "faith";
  const { resizeNotch, toggle, expanded, previewSize } = useNotchWindow();
  const [collapseDelaySeconds, setCollapseDelaySeconds] = useState(loadCollapseDelaySeconds);
  const [activityCount, setActivityCount] = useState(0);
  const [pointerInside, setPointerInside] = useState(false);
  const [page, setPage] = useState<Page>("splash");
  const [appModal, setAppModal] = useState<AppModalContent | null>(null);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [reminderCycle, setReminderCycle] = useState(0);
  const reminderCloseTimer = useRef<number | undefined>(undefined);
  const closeReminder = useCallback(() => {
    if (reminderCloseTimer.current !== undefined) window.clearTimeout(reminderCloseTimer.current);
    reminderCloseTimer.current = undefined;
    setReminderVisible(false);
    setHomeTab("Home");
    setPage("home");
    void resizeNotch(false, false);
  }, [resizeNotch]);
  const showEventReminder = useCallback(() => {
    setReminderVisible(true);
    setReminderCycle(cycle => cycle + 1);
    void resizeNotch(true, true);
  }, [resizeNotch]);
  useEffect(() => {
    if (!reminderVisible) return;
    const { closeAfterSeconds } = loadReminderPreferences();
    reminderCloseTimer.current = window.setTimeout(closeReminder, closeAfterSeconds * 1000);
    return () => {
      if (reminderCloseTimer.current !== undefined) window.clearTimeout(reminderCloseTimer.current);
      reminderCloseTimer.current = undefined;
    };
  }, [reminderVisible, reminderCycle, closeReminder]);
  useEventReminders(!windowKind && isTauri(), showEventReminder);
  useFaithReminders(!windowKind && isTauri(), goal => setAppModal({ title: "A gentle reminder", message: `You made space for “${goal.title}”. Begin again whenever you’re ready.`, confirmLabel: "Open Faith Journey", cancelLabel: "Maybe later", onConfirm: () => { void openDockedWindow("faith"); } }));
  useEffect(() => {
    if (windowKind) return;
    void getAllWebviewWindows().then(windows => {
      const oldReminder = windows.find(window => window.label === "near-reminders");
      if (oldReminder) void oldReminder.close().catch(() => {});
    }).catch(() => {});
  }, [windowKind]);
  const [chatGptSignInBusy, setChatGptSignInBusy] = useState(false);
  const [chatGptSignInMessage, setChatGptSignInMessage] = useState("");
  const [voiceSetupFlow, setVoiceSetupFlow] = useState<VoiceSetupFlow>({ next: "finish-setup" });
  const [agent, setAgent] = useState<AgentChoice>(() => {
    const savedAgent = localStorage.getItem(
      AGENT_CHOICE_KEY,
    ) as AgentChoice | null;
    return savedAgent && AGENT_CHOICES.includes(savedAgent)
      ? savedAgent
      : "ChatGPT";
  });
  const [nearVoice, setNearVoice] = useState(
    () => localStorage.getItem(NEAR_VOICE_KEY) ?? "",
  );
  const [homeTab, setHomeTab] = useState<HomeSection>("Home");
  const [voiceReply, setVoiceReply] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceSpeech, setVoiceSpeech] = useState<NearSpeechStream | null>(null);
  const [voiceHistory, setVoiceHistory] = useState<ChatTurn[]>([]);
  const [wakeWordListening, setWakeWordListening] = useState(false);

  useEffect(() => {
    const refreshDelay = () => setCollapseDelaySeconds(loadCollapseDelaySeconds());
    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLAPSE_DELAY_KEY) refreshDelay();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshDelay);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshDelay);
    };
  }, []);
  useEffect(() => {
    if (!expanded || pointerInside || reminderVisible || page !== "home") return;
    const timer = window.setTimeout(() => resizeNotch(false, false), collapseDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [expanded, pointerInside, reminderVisible, page, collapseDelaySeconds, activityCount, resizeNotch]);
  useEffect(() => {
    if (isChatWindow) return;
    if (page !== "intro-splash") return;
    void resizeNotch(true, false);
  }, [page, resizeNotch]);
  const finishSplash = useCallback(() => {
    if (import.meta.env.DEV) localStorage.removeItem(SETUP_COMPLETE_KEY);
    setPage(localStorage.getItem(SETUP_COMPLETE_KEY) === "true" ? "home" : "welcome");
  }, []);
  const handleConnectionReady = useCallback(
    () => setPage("intro-splash"),
    [],
  );
  const handleAgentChange = useCallback((nextAgent: AgentChoice) => {
    localStorage.setItem(AGENT_CHOICE_KEY, nextAgent);
    setAgent(nextAgent);
    setChatGptSignInMessage("");
  }, []);
  const completeSetup = useCallback(() => {
    localStorage.setItem(SETUP_COMPLETE_KEY, "true");
    navigate("home");
  }, []);
  const startChatGptSignIn = useCallback(async () => {
    setChatGptSignInBusy(true);
    setChatGptSignInMessage("");
    setChatGptSignInMessage("Opening ChatGPT sign-in…");
    try {
      const url = await invoke<string>("chatgpt_begin_login", { newAccount: true });
      await openUrl(url);
      setChatGptSignInMessage("Finish signing in in your browser. NEAR will continue automatically.");
    } catch (error) {
      setChatGptSignInMessage(`Could not connect to ${agent}: ${String(error)}`);
      setChatGptSignInBusy(false);
      setPage("choose-agent");
    }
  }, [agent]);
  const handleVoiceChange = useCallback((voiceName: string) => {
    localStorage.setItem(NEAR_VOICE_KEY, voiceName);
    setNearVoice(voiceName);
  }, []);
  const handleVoiceMessage = useCallback(
    async (message: string, onDelta?: (delta: string) => void) => {
      const nextHistory: ChatTurn[] = [
        ...voiceHistory,
        { role: "user", content: message },
      ];
      const reply = await sendChat(nextHistory, onDelta, { mode: "voice" });
      setVoiceHistory([...nextHistory, { role: "assistant", content: reply }]);
      return reply;
    },
    [voiceHistory],
  );
  const startNewVoiceConversation = useCallback(() => {
    stopNearVoice();
    setVoiceHistory([]);
    setVoiceTranscript("");
    setVoiceReply("");
    setVoiceSpeech(null);
    navigate("listening");
  }, []);

  useEffect(() => {
    if (isChatWindow || ![
      "home", "daily-verse", "quiet-mode", "reminder-preview",
      "voice-settings", "type-message", "conversation-history",
    ].includes(page)) return;
    let active = true;
    let session: TranscriptionSession | null = null;
    void (async () => {
      try {
        const status = await localTranscription.modelStatus();
        if (!active || !status.installed) return;
        await localTranscription.prepare();
        if (!active) return;
        session = await localTranscription.start((text) => {
          if (!active || !/^(?:hey[,\s]+)?near[.!?]?$/iu.test(text.trim())) return;
          console.info("[NEAR wake word] Opening Talk to NEAR:", text);
          active = false;
          session?.cancel();
          setWakeWordListening(false);
          void resizeNotch(true, true);
          startNewVoiceConversation();
        }, (error) => {
          console.error("[NEAR wake word] Recognition stopped:", error);
          active = false;
          session?.cancel();
          setWakeWordListening(false);
        }, { latestChunkOnly: true });
        if (!active) session.cancel();
        else setWakeWordListening(true);
      } catch (error) {
        if (active) console.error("[NEAR wake word] Could not start recognition:", error);
      }
    })();
    return () => {
      active = false;
      session?.cancel();
      setWakeWordListening(false);
    };
  }, [isChatWindow, page, resizeNotch, startNewVoiceConversation]);

  useEffect(() => {
    if (isChatWindow) return;
    void resizeNotch(true, false);
    const timer = window.setTimeout(finishSplash, 2400);
    return () => window.clearTimeout(timer);
  }, [finishSplash, resizeNotch]);

  useEffect(() => {
    if (isChatWindow) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (reminderVisible) closeReminder();
        else resizeNotch(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resizeNotch, reminderVisible, closeReminder]);

  useEffect(() => {
    const onKeyDown = () => setActivityCount(count => count + 1);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (isChatWindow) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    listen("near://toggle-notch", () => toggle())
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [toggle]);

  useEffect(() => {
    if (isChatWindow) return;
    let disposed = false;
    const unlisten: Array<() => void> = [];
    void listen("near://chatgpt-auth-complete", async () => {
      setChatGptSignInMessage("Checking ChatGPT connection…");
      try {
        const status = await invoke<ChatGptStatus>("chatgpt_status");
        if (disposed) return;
        setChatGptSignInBusy(false);
        if (status.connected && status.plan_usage_enabled) {
          setChatGptSignInMessage("");
          setPage("testing-connection");
          void getCurrentWindow().setFocusable(true).then(() => getCurrentWindow().setFocus()).catch(() => {});
        } else {
          setChatGptSignInMessage(status.message || "ChatGPT connection was not completed.");
          setPage("choose-agent");
        }
      } catch (error) {
        if (!disposed) {
          setChatGptSignInBusy(false);
          setChatGptSignInMessage(`Could not verify the ChatGPT connection: ${String(error)}`);
          setPage("choose-agent");
        }
      }
    }).then((stop) => { if (disposed) stop(); else unlisten.push(stop); }).catch(() => {});
    void listen<string>("near://chatgpt-auth-error", ({ payload }) => {
      if (!disposed) {
        setChatGptSignInBusy(false);
        setChatGptSignInMessage(friendlyChatGptError(payload));
        setPage("choose-agent");
      }
    }).then((stop) => { if (disposed) stop(); else unlisten.push(stop); }).catch(() => {});
    void listen<{ url: string; diagnostic: string }>("near://chatgpt-auth-retry", ({ payload }) => {
      if (disposed) return;
      setChatGptSignInMessage(`${friendlyChatGptError(payload.diagnostic)} A fresh sign-in was opened in a new browser tab.`);
      void openUrl(payload.url).catch(error => {
        setChatGptSignInBusy(false);
        setChatGptSignInMessage(friendlyChatGptError(error));
      });
    }).then((stop) => { if (disposed) stop(); else unlisten.push(stop); }).catch(() => {});
    return () => { disposed = true; unlisten.forEach((stop) => stop()); };
  }, []);

  function navigate(next: Page) {
    if (next !== "speaking-response") setVoiceSpeech(null);
    void getCurrentWindow()
      .setFocusable(true)
      .then(() => getCurrentWindow().setFocus())
      .catch(() => {});
    setPage(next);
  }

  function startVoiceSetup() {
    setVoiceSetupFlow({ next: "local-data" });
    navigate("test-voice");
  }

  const openPanel = (kind: "bible" | "notes" | "church" | "settings") => {
    const title = { bible: "Bible", notes: "Notes", church: "Church Calendar", settings: "Settings" }[kind];
    void openDockedWindow(kind, message => setAppModal({ title: `Could not open ${title}`, message }))
      .catch(error => setAppModal({ title: `Could not open ${title}`, message: String(error) }));
  };

  const openBiblePassage = (passage?: { book: number; chapter: number; verse: number; endVerse?: number }) => {
    const query = passage ? `&book=${passage.book}&chapter=${passage.chapter}&verse=${passage.verse}` : "";
    void openDockedWindow("bible", message => setAppModal({ title: "Could not open Bible", message }), query)
      .then(async existing => {
        if (passage && isTauri() && existing) {
          const { emitTo } = await import("@tauri-apps/api/event");
          await emitTo("near-bible", "near://open-passage", { book: passage.book, chapter: passage.chapter, verse: passage.verse });
        }
      }).catch(error => setAppModal({ title: "Could not open Bible", message: String(error) }));
  };

  const openFaithJourney = (passage?: { book: number; chapter: number; verse: number; endVerse?: number }) => {
    const query = passage ? `&book=${passage.book}&chapter=${passage.chapter}&start=${passage.verse}&end=${passage.endVerse ?? passage.verse}` : "";
    void openDockedWindow("faith", message => setAppModal({ title: "Could not open Faith Journey", message }), query)
      .then(async existing => {
        if (passage && isTauri() && existing) {
          const { emitTo } = await import("@tauri-apps/api/event");
          await emitTo("near-faith", "near://start-reflection", passage);
        }
      }).catch(error => setAppModal({ title: "Could not open Faith Journey", message: String(error) }));
  };

  async function openChatWindow() {
    if (!isTauri()) {
      window.open("/?window=chat", "near-chat", "popup,width=720,height=620");
      return;
    }
    const existing = (await getAllWebviewWindows()).find((candidate) => candidate.label === "near-chat");
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }
    const chatWindow = new WebviewWindow("near-chat", {
      url: "/?window=chat",
      title: "Chat with NEAR",
      width: 720,
      height: 620,
      minWidth: 520,
      minHeight: 420,
      center: true,
      decorations: false,
      transparent: false,
      resizable: true,
      alwaysOnTop: false,
    });
    chatWindow.once("tauri://error", ({ payload }) => setAppModal({ title: "Could not open Chat", message: String(payload) }));
  }

  function renderPage() {
    switch (page) {
      case "splash":
        return <SplashPage />;
      case "welcome":
        return (
          <WelcomePage
            onGetStarted={startVoiceSetup}
            onExplore={() => navigate("home")}
          />
        );
      case "local-data":
        return (
          <LocalDataPage
            onBack={() => navigate("welcome")}
            onContinue={() => navigate("choose-agent")}
          />
        );
      case "choose-agent":
        return (
          <ChooseAgentPage
            agent={agent}
            onAgentChange={handleAgentChange}
            onLater={() => { setChatGptSignInMessage(""); navigate("home"); }}
            onContinue={() => navigate("agent-found")}
            error={chatGptSignInMessage}
          />
        );
      case "agent-found":
        return (
          <AgentFoundPage
            agent={agent}
            onConnect={() => void startChatGptSignIn()}
            onChooseAnother={() => navigate("agent-missing")}
            busy={chatGptSignInBusy}
            message={chatGptSignInMessage}
          />
        );
      case "agent-missing":
        return (
          <AgentMissingPage
            onOpenGuide={() => navigate("setup-guide")}
            onCheckAgain={() => navigate("agent-found")}
            onBasicMode={() => navigate("home")}
          />
        );
      case "setup-guide":
        return (
          <SetupGuidePage
            onBack={() => navigate("agent-missing")}
            onCheckAgain={() => navigate("agent-found")}
          />
        );
      case "testing-connection":
        return (
          <TestingConnectionPage
            onCancel={() => navigate("choose-agent")}
            onReady={handleConnectionReady}
          />
        );
      case "microphone-choice":
        return (
          <MicrophoneChoicePage
            onEnableVoice={() => {
              setVoiceSetupFlow({ next: "finish-setup" });
              navigate("test-voice");
            }}
            onUseTyping={() => navigate("finish-setup")}
          />
        );
      case "local-voice-setup":
        return (
          <LocalVoiceSetupPage
            voiceName={nearVoice}
            onVoiceChange={handleVoiceChange}
            onContinue={() => {
              setVoiceSetupFlow({ next: "finish-setup" });
              navigate("test-voice");
            }}
            onUseTyping={() => navigate("finish-setup")}
          />
        );
      case "test-voice":
        return (
          <TestVoicePage
            voiceName={nearVoice}
            onVoiceChange={handleVoiceChange}
            onLater={() => navigate("bible-setup")}
            onContinue={() => navigate("bible-setup")}
          />
        );
      case "bible-setup":
        return (
          <BibleSetupPage
            onLater={() => navigate(voiceSetupFlow.next)}
            onContinue={() => navigate(voiceSetupFlow.next)}
          />
        );
      case "voice-settings":
        return (
          <VoiceSettingsPage
            voiceName={nearVoice}
            onVoiceChange={handleVoiceChange}
            onClose={() => navigate("quiet-mode")}
          />
        );
      case "finish-setup":
        return (
          <FinishSetupPage
            onBack={() => navigate("test-voice")}
            onFinish={completeSetup}
          />
        );
      case "home":
        return (
          <HomePage
            agent={agent}
            activeTab={homeTab}
            onTabChange={setHomeTab}
            onSettings={() => openPanel("settings")}
            onFaithJourney={() => openFaithJourney()}
            onChurch={() => openPanel("church")}
            onNotes={() => openPanel("notes")}
            onTalk={startNewVoiceConversation}
            onType={() => void openChatWindow().catch(error => setAppModal({ title: "Could not open Chat", message: String(error) }))}
            onReviewChange={openBiblePassage}
          />
        );
      case "daily-verse":
        return (
          <DailyVersePage
            onRead={() => navigate("home")}
            onReflect={passage => openFaithJourney(passage)}
            onLater={() => navigate("home")}
          />
        );
      case "reminder-preview":
        return (
          <ReminderPreviewPage
            voiceName={nearVoice}
          />
        );
      case "quiet-mode":
        return (
          <QuietModePage
            onResume={() => navigate("home")}
            onAdjust={() => navigate("finish-setup")}
            onChangeVoice={() => navigate("voice-settings")}
          />
        );
      case "listening":
        return (
          <ListeningPage
            onSend={handleVoiceMessage}
            onComplete={(transcript, reply, speech) => {
              setVoiceTranscript(transcript);
              setVoiceReply(reply);
              setVoiceSpeech(speech);
            }}
            onHome={() => navigate("home")}
          />
        );
      case "understanding-request":
        return (
          <UnderstandingRequestPage
            onCancel={() => navigate("request-stopped")}
            onNext={() => navigate("running-actions")}
            onHome={() => navigate("home")}
          />
        );
      case "running-actions":
        return (
          <RunningActionsPage
            onStop={() => navigate("request-stopped")}
            onNext={() => navigate("speaking-response")}
            onHome={() => navigate("home")}
          />
        );
      case "speaking-response":
        return (
          <SpeakingResponsePage
            response={voiceReply}
            transcript={voiceTranscript}
            voiceName={nearVoice}
            speechStream={voiceSpeech}
            hideResponseText={Boolean(voiceSpeech)}
            onTalkAgain={() => navigate("listening")}
            onType={() => void openChatWindow()}
            onHome={() => navigate("home")}
          />
        );
      case "type-message":
        return (
          <TypeMessagePage
            onSend={(history) => sendChat(history)}
            onListen={() => navigate("listening")}
            onHistory={() => navigate("conversation-history")}
            onHome={() => navigate("home")}
          />
        );
      case "conversation-history":
        return (
          <ConversationHistoryPage
            onBack={() => navigate("type-message")}
            onOpen={() => navigate("type-message")}
            onNew={() => navigate("type-message")}
            onHome={() => navigate("home")}
          />
        );
      case "review-change":
        return (
          <ReviewChangePage
            onApply={() => navigate("partial-success")}
            onKeep={() => navigate("home")}
            onHome={() => navigate("home")}
          />
        );
      case "partial-success":
        return (
          <PartialSuccessPage
            onRetry={() => navigate("agent-unavailable")}
            onViewReminder={() => navigate("request-stopped")}
            onHome={() => navigate("home")}
          />
        );
      case "agent-unavailable":
        return (
          <AgentUnavailablePage
            onRetry={() => navigate("sign-in-expired")}
            onChooseAgent={() => navigate("choose-agent")}
            onNotes={() => navigate("home")}
            onHome={() => navigate("home")}
          />
        );
      case "sign-in-expired":
        return (
          <SignInExpiredPage
            onReconnect={() => void startChatGptSignIn()}
            onBasicMode={() => navigate("home")}
            onHome={() => navigate("home")}
          />
        );
      case "usage-limit":
        return (
          <UsageLimitPage
            onSwitchAgent={() => navigate("choose-agent")}
            onHome={() => navigate("home")}
          />
        );
      case "request-stopped":
        return (
          <RequestStoppedPage
            onViewReminder={() => navigate("reminder-preview")}
            onUndo={() => navigate("home")}
            onDone={() => navigate("home")}
            onHome={() => navigate("home")}
          />
        );
    }
  }

  const showProgress = [
    "welcome",
    "local-data",
    "choose-agent",
    "agent-found",
    "agent-missing",
    "setup-guide",
    "testing-connection",
    "microphone-choice",
    "local-voice-setup",
    "test-voice",
    "bible-setup",
    "finish-setup",
  ].includes(page);
  const connected = [
    "home",
    "daily-verse",
    "reminder-preview",
    "quiet-mode",
    "voice-settings",
    "listening",
    "understanding-request",
    "running-actions",
    "speaking-response",
    "type-message",
    "conversation-history",
    "review-change",
    "partial-success",
    "request-stopped",
  ].includes(page);
  const unavailable = page === "agent-unavailable";
  const usageLimit = page === "usage-limit";
  const microphoneStatus =
    page === "listening"
      ? "listening"
      : page === "speaking-response"
        ? "speaking"
        : wakeWordListening ? "listening" : "off";
  if (windowKind === "church") return <ChurchCalendarWindow />;
  if (windowKind === "notes") return <NotesWindow />;
  if (windowKind === "bible") return <BibleWindow />;
  if (windowKind === "settings") return <SettingsWindow />;
  if (windowKind === "faith") return <FaithJourneyWindow />;
  if (isChatWindow) return <ChatWindow />;
  return (
    <>
    <NotchFrame
      previewSize={previewSize}
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
      onPointerDown={() => {
        setActivityCount(count => count + 1);
        void getCurrentWindow()
          .setFocusable(true)
          .catch(() => {});
      }}
      collapsed={
        <CollapsedEyes active={!expanded} onClick={toggle} />
      }
    >
      {(page === "splash" || page === "intro-splash") && !reminderVisible ? (
        <SplashPage intro={page === "intro-splash"} voiceName={nearVoice} onComplete={completeSetup} />
      ) : (
        <div className="relative mx-auto flex h-full w-full max-w-[560px] flex-col">
          <NotchHeader
            status={
              reminderVisible
                ? "Reminder"
                : page === "choose-agent"
                ? "Choose an agent"
                : page === "agent-found"
                  ? `${agent} found`
                  : connected ||
                      page === "microphone-choice"
                    ? `${agent} connected`
                    : unavailable
                      ? "Agent unavailable"
                      : usageLimit
                        ? "Usage limit"
                        : page === "agent-missing"
                          ? "Agent not installed"
                          : page === "setup-guide"
                            ? "Setup guide"
                            : page === "sign-in-expired"
                              ? "Sign-in needed"
                              : page === "testing-connection"
                                ? "Checking connection"
                                : page === "local-voice-setup"
                                  ? "Voice setup"
                                  : page === "test-voice"
                                    ? "Voice test"
                                  : page === "bible-setup"
                                    ? "Bible setup"
                                    : page === "finish-setup"
                                      ? "Setup preferences"
                                      : "No agent connected"
            }
            tone={
              reminderVisible
                ? "warning"
                : page === "agent-found" || connected
                ? "success"
                : page === "agent-missing"
                  ? "error"
                  : page === "sign-in-expired" ||
                      unavailable ||
                      usageLimit
                    ? "warning"
                    : "neutral"
            }
            microphoneStatus={microphoneStatus}
            onCollapse={() => {
              if (reminderVisible) closeReminder();
              if (page === "listening" || (page === "speaking-response" && voiceSpeech)) navigate("home");
              resizeNotch(false);
            }}
            onSettings={() => openPanel("settings")}
            onMicrophone={() =>
              navigate(connected ? "listening" : "microphone-choice")
            }
          />
          <div
            className={`relative z-[1] overflow-x-hidden overscroll-contain ${reminderVisible || page === "test-voice" || page === "bible-setup" || page === "listening" ? "overflow-y-hidden" : "overflow-y-auto [scrollbar-color:rgba(140,170,196,0.35)_transparent] [scrollbar-width:thin]"} ${showProgress ? "h-[calc(100%-60px)]" : "h-[calc(100%-30px)]"}`}
            key={page}
          >
            {reminderVisible ? <ReminderPreviewPage key={reminderCycle} voiceName={nearVoice} /> : renderPage()}
          </div>
          {showProgress && <PageProgress page={page} onNavigate={navigate} />}
        </div>
      )}
    </NotchFrame>
    {appModal && createPortal(<AppModal {...appModal} onClose={() => setAppModal(null)} />, document.body)}
    </>
  );
}

export default App;
 
