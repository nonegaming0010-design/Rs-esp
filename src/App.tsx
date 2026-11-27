import { onAuthStateChanged, type User } from 'firebase/auth';
import { Megaphone, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPanelView } from './components/AdminPanelView';
import { AiCodeMaker } from './components/AiCodeMaker';
import { AuthModal } from './components/AuthModal';
import { Circuit3dPreview } from './components/Circuit3dPreview';
import { CodeEditorPanel } from './components/CodeEditorPanel';
import { CommunityView } from './components/CommunityView';
import { PinoutToolsView } from './components/PinoutToolsView';
import { ProjectLibraryView } from './components/ProjectLibraryView';
import { PublishSketchModal } from './components/PublishSketchModal';
import { SavedSketchesDrawer } from './components/SavedSketchesDrawer';
import { SerialAndUploadView } from './components/SerialAndUploadView';
import { TopNav, type AppSection } from './components/TopNav';
import { WiringAndSpecsPanel } from './components/WiringAndSpecsPanel';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { getBoardById } from './data/boards';
import { mergeComponentIntoProject, type ComponentCatalogItem } from './data/componentsCatalog';
import { BEGINNER_PROJECTS } from './data/projects/index';
import { auth } from './firebase';
import { subscribeIsDelegatedAdmin, subscribeSiteConfig } from './services/adminService';
import { syncUserProfile } from './services/cloudSketches';
import {
  DEFAULT_SITE_CONFIG,
  isVerifiedAdminUser,
  type SiteConfig,
} from './utils/adminHelpers';
import type {
  AiGeneratedResult,
  CloudSketch,
  EspProject,
  FrameworkId,
  SavedSketch,
  SerialLogEntry,
  WiringItem,
} from './types/esp';
import {
  buildPlatformIoIni,
  buildStarterBlinkCode,
  detectRequiredLibraries,
  getSketchFilename,
  isStarterBlinkCode,
} from './utils/espHelpers';
import { processVirtualEspCommand, processVirtualEspHexBytes } from './utils/espSimulator';
import { generateTechnicalDatasheetPdf } from './utils/datasheetPdf';
import { buildProjectZipBundle } from './utils/projectBundle';
import {
  loadSavedSketches,
  loadViewMode,
  loadWorkspaceDraft,
  persistSavedSketches,
  saveViewMode,
  saveWorkspaceDraft,
  type AppViewMode,
} from './utils/storage';
import {
  checkWebSerialSupport,
  findAuthorizedEspPort,
  flashFirmwareBinary,
  openSerialMonitorSession,
  requestEspSerialPort,
  uploadMicroPythonScript,
  type LineEnding,
  type SerialPortSession,
} from './utils/webSerial';

function formatNow(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

const INITIAL_PROJECT = BEGINNER_PROJECTS[0];

export default function App() {
  const initialDraft = useMemo(() => loadWorkspaceDraft(), []);

  const [activeSection, setActiveSection] = useState<AppSection>('studio');
  const [selectedBoardId, setSelectedBoardId] = useState<string>(
    initialDraft?.boardId ?? INITIAL_PROJECT.recommendedBoardId
  );
  const [framework, setFramework] = useState<FrameworkId>(
    initialDraft?.framework ?? INITIAL_PROJECT.framework
  );
  const [isDark, setIsDark] = useState<boolean>(initialDraft?.isDark ?? false);

  // Active sketch state (auto-restored from localStorage)
  const [sketchTitle, setSketchTitle] = useState<string>(
    initialDraft?.title ?? INITIAL_PROJECT.title
  );
  const [code, setCode] = useState<string>(initialDraft?.code ?? INITIAL_PROJECT.code);
  const [explanation, setExplanation] = useState<string>(
    initialDraft?.explanation ?? INITIAL_PROJECT.summary
  );
  const [wiring, setWiring] = useState<WiringItem[]>(
    initialDraft?.wiring.length ? initialDraft.wiring : INITIAL_PROJECT.wiring
  );
  const [libraries, setLibraries] = useState<string[]>(
    initialDraft?.libraries ?? INITIAL_PROJECT.libraries
  );
  const [warnings, setWarnings] = useState<string[]>([]);
  const [baudRate, setBaudRate] = useState<number>(
    initialDraft?.baudRate ?? INITIAL_PROJECT.baudRate
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [previousCode, setPreviousCode] = useState<string | null>(null);

  // Saved Sketches & Cloud Community Auth state
  const [savedSketches, setSavedSketches] = useState<SavedSketch[]>(() => loadSavedSketches());
  const [savedDrawerOpen, setSavedDrawerOpen] = useState<boolean>(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string | null>(
    initialDraft ? 'Restored draft' : null
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [, setAuthRefreshTick] = useState<number>(0);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authPromptReason, setAuthPromptReason] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<AppViewMode>(() => loadViewMode());
  const isPhoneView = viewMode === 'phone';
  const [isDelegatedAdmin, setIsDelegatedAdmin] = useState<boolean>(false);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState<string>('');
  const [publishModalState, setPublishModalState] = useState<{
    open: boolean;
    editingSketch?: CloudSketch;
  }>({ open: false });

  const openAuthModal = useCallback((reason?: string) => {
    setAuthPromptReason(reason ?? null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthPromptReason(null);
  }, []);

  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next: AppViewMode = prev === 'phone' ? 'desktop' : 'phone';
      saveViewMode(next);
      return next;
    });
  }, []);

  // Serial & Uploader state
  const [connectionMode, setConnectionMode] = useState<'disconnected' | 'usb' | 'virtual'>('disconnected');
  const [serialLogs, setSerialLogs] = useState<SerialLogEntry[]>([]);
  const [flashProgress, setFlashProgress] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [virtualLed, setVirtualLed] = useState<boolean>(false);
  const [virtualTelemetryActive, setVirtualTelemetryActive] = useState<boolean>(false);

  const serialSessionRef = useRef<SerialPortSession | null>(null);
  const serialPortRef = useRef<SerialPort | null>(null);
  const lastPortInfoRef = useRef<{ usbVendorId?: number; usbProductId?: number } | undefined>(undefined);
  const manualDisconnectRef = useRef<boolean>(false);
  const isFlashingRef = useRef<boolean>(false);
  const autoReconnectRef = useRef<boolean>(true);
  const reconnectTimerRef = useRef<number | null>(null);
  const rxBufferRef = useRef<string>('');
  const rxBytesRef = useRef<number[]>([]);
  const textEncoder = useMemo(() => new TextEncoder(), []);

  const selectedBoard = useMemo(() => getBoardById(selectedBoardId), [selectedBoardId]);

  useEffect(() => {
    autoReconnectRef.current = autoReconnect;
  }, [autoReconnect]);

  useEffect(() => {
    isFlashingRef.current = isFlashing;
  }, [isFlashing]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      if (u?.emailVerified) {
        void syncUserProfile(u).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeSiteConfig(setSiteConfig);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser?.uid || !currentUser.emailVerified) {
      setIsDelegatedAdmin(false);
      return;
    }
    const unsub = subscribeIsDelegatedAdmin(currentUser.uid, setIsDelegatedAdmin);
    return () => unsub();
  }, [currentUser?.uid, currentUser?.emailVerified]);

  const isAdmin = useMemo(
    () => isVerifiedAdminUser(currentUser, isDelegatedAdmin),
    [currentUser, isDelegatedAdmin]
  );

  useEffect(() => {
    if (!isAdmin && activeSection === 'admin') {
      setActiveSection('studio');
    }
  }, [isAdmin, activeSection]);

  const skipInitialAutoSaveRef = useRef<boolean>(Boolean(initialDraft));

  // Auto-save active workspace draft locally (debounced 250ms)
  useEffect(() => {
    if (skipInitialAutoSaveRef.current) {
      skipInitialAutoSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const ok = saveWorkspaceDraft({
        boardId: selectedBoardId,
        framework,
        title: sketchTitle,
        code,
        explanation,
        wiring,
        libraries,
        baudRate,
        isDark,
        updatedAt: new Date().toISOString(),
      });
      if (ok) {
        setLastSavedLabel(`Saved ${formatNow().slice(0, 5)}`);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [selectedBoardId, framework, sketchTitle, code, explanation, wiring, libraries, baudRate, isDark]);

  const appendLog = useCallback(
    (direction: SerialLogEntry['direction'], text: string, rawBytes?: number[]) => {
      const lines = text.split(/\r?\n/);
      const entries: SerialLogEntry[] = lines
        .filter((line, idx) => line.length > 0 || idx === 0)
        .map((line, idx) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: formatNow(),
          direction,
          text: line,
          rawBytes: idx === 0 ? rawBytes : undefined,
        }));
      if (entries.length === 0) return;
      setSerialLogs((prev) => [...prev.slice(-400), ...entries]);
    },
    []
  );

  // Virtual live sensor telemetry stream for Serial Plotter & Hex View testing
  useEffect(() => {
    if (!virtualTelemetryActive || connectionMode !== 'virtual') return;
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      const temp = (24.0 + Math.sin(tick * 0.35) * 2.4).toFixed(2);
      const humidity = (58.0 + Math.cos(tick * 0.25) * 4.2).toFixed(2);
      const line = `temp:${temp},humidity:${humidity}`;
      appendLog('rx', line, Array.from(textEncoder.encode(line + '\n')));
    }, 900);
    return () => window.clearInterval(timer);
  }, [virtualTelemetryActive, connectionMode, appendLog, textEncoder]);

  // Cleanup USB serial port & reconnect timer on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      serialSessionRef.current?.close().catch(() => {});
    };
  }, []);

  const handleAiResult = useCallback(
    (result: AiGeneratedResult) => {
      setPreviousCode(code);
      setSketchTitle(result.title || sketchTitle);
      if (result.code) setCode(result.code);
      if (result.explanation) setExplanation(result.explanation);
      setWiring(Array.isArray(result.wiring) ? result.wiring : []);
      setLibraries(Array.isArray(result.libraries) ? result.libraries : []);
      setWarnings(Array.isArray(result.warnings) ? result.warnings : []);
      setBaudRate(result.baudRate || 115200);
    },
    [code, sketchTitle]
  );

  const handleAiExplainResult = useCallback((result: AiGeneratedResult) => {
    if (result.explanation) setExplanation(result.explanation);
    if (Array.isArray(result.wiring) && result.wiring.length > 0) setWiring(result.wiring);
    if (Array.isArray(result.libraries) && result.libraries.length > 0) setLibraries(result.libraries);
    if (Array.isArray(result.warnings)) setWarnings(result.warnings);
  }, []);

  const handleUndoCode = useCallback(() => {
    if (previousCode !== null) {
      setCode(previousCode);
      setPreviousCode(null);
    }
  }, [previousCode]);

  const handleAddComponent = useCallback(
    (component: ComponentCatalogItem) => {
      const merged = mergeComponentIntoProject(component, selectedBoard, wiring, libraries);
      setWiring(merged.nextWiring);
      setLibraries(merged.nextLibraries);
      if (merged.addedWiringCount > 0 || merged.addedLibCount > 0) {
        setLastSavedLabel(`Added ${component.shortName}`);
      }
      return {
        addedWiringCount: merged.addedWiringCount,
        addedLibCount: merged.addedLibCount,
      };
    },
    [selectedBoard, wiring, libraries]
  );

  const handleRemoveWiringRow = useCallback((index: number) => {
    setWiring((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleSelectBoard = useCallback(
    (nextBoardId: string) => {
      setSelectedBoardId(nextBoardId);
      if (isStarterBlinkCode(code)) {
        const nextBoard = getBoardById(nextBoardId);
        setCode(buildStarterBlinkCode(nextBoardId, framework));
        setWiring([
          {
            from: 'Onboard LED',
            to: `GPIO ${nextBoard.defaultLedPin}`,
            note: `Built-in LED on ${nextBoard.shortName}`,
          },
        ]);
      }
    },
    [code, framework]
  );

  const handleSelectFramework = useCallback(
    (nextFramework: FrameworkId) => {
      setFramework(nextFramework);
      if (isStarterBlinkCode(code)) {
        const currentBoard = getBoardById(selectedBoardId);
        setCode(buildStarterBlinkCode(selectedBoardId, nextFramework));
        setWiring([
          {
            from: 'Onboard LED',
            to: `GPIO ${currentBoard.defaultLedPin}`,
            note: `Built-in LED on ${currentBoard.shortName}`,
          },
        ]);
      }
    },
    [code, selectedBoardId]
  );

  const handleLoadProject = useCallback((project: EspProject) => {
    setPreviousCode(null);
    setSketchTitle(project.title);
    setCode(project.code);
    setExplanation(project.summary);
    setWiring(project.wiring);
    setLibraries(project.libraries);
    setWarnings([]);
    setBaudRate(project.baudRate || 115200);
    setFramework(project.framework);
    setSelectedBoardId(project.recommendedBoardId);
    setActiveSection('studio');
  }, []);

  const handleLoadCloudSketch = useCallback((sketch: CloudSketch) => {
    setPreviousCode(null);
    setSketchTitle(sketch.title);
    setSelectedBoardId(sketch.boardId);
    setFramework(sketch.framework);
    setCode(sketch.code);
    setExplanation(sketch.summary || `Loaded "${sketch.title}" by ${sketch.authorName}.`);
    setWiring(Array.isArray(sketch.wiring) ? sketch.wiring : []);
    setLibraries(Array.isArray(sketch.libraries) ? sketch.libraries : []);
    setBaudRate(sketch.baudRate || 115200);
    setWarnings([]);
    setActiveSection('studio');
  }, []);

  const handleSaveCurrentSketch = useCallback(
    (customTitle: string) => {
      const nextTitle = customTitle.trim() || sketchTitle || 'Custom ESP Sketch';
      const newSketch: SavedSketch = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: nextTitle,
        boardId: selectedBoardId,
        framework,
        code,
        explanation,
        wiring,
        libraries,
        baudRate,
        updatedAt: new Date().toISOString(),
      };
      setSavedSketches((prev) => {
        const next = [newSketch, ...prev];
        persistSavedSketches(next);
        return next;
      });
      setSketchTitle(nextTitle);
      setLastSavedLabel(`Saved "${nextTitle.slice(0, 18)}"`);
    },
    [sketchTitle, selectedBoardId, framework, code, explanation, wiring, libraries, baudRate]
  );

  const handleLoadSavedSketch = useCallback((sketch: SavedSketch) => {
    setSketchTitle(sketch.title);
    setSelectedBoardId(sketch.boardId);
    setFramework(sketch.framework);
    setCode(sketch.code);
    setExplanation(sketch.explanation);
    setWiring(sketch.wiring);
    setLibraries(sketch.libraries);
    setBaudRate(sketch.baudRate || 115200);
    setWarnings([]);
    setActiveSection('studio');
  }, []);

  const handleRenameSavedSketch = useCallback((id: string, nextTitle: string) => {
    setSavedSketches((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, title: nextTitle, updatedAt: new Date().toISOString() } : s
      );
      persistSavedSketches(next);
      return next;
    });
  }, []);

  const handleDeleteSavedSketch = useCallback((id: string) => {
    setSavedSketches((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persistSavedSketches(next);
      return next;
    });
  }, []);

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        // ignore fallback clipboard errors
      }
    }
  };

  const downloadBlob = (filename: string, data: BlobPart, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSketch = () => {
    downloadBlob(getSketchFilename(framework, sketchTitle), code, 'text/plain;charset=utf-8');
  };

  const handleDownloadPlatformIo = () => {
    const libs = Array.from(new Set([...libraries, ...detectRequiredLibraries(code)]));
    downloadBlob('platformio.ini', buildPlatformIoIni(selectedBoard.id, libs), 'text/plain;charset=utf-8');
  };

  const handleDownloadProjectZip = () => {
    const bundle = buildProjectZipBundle({
      title: sketchTitle,
      code,
      boardId: selectedBoard.id,
      framework,
      wiring,
      libraries,
      baudRate,
      explanation,
    });
    const copiedBuffer = new Uint8Array(bundle.archive).buffer;
    downloadBlob(bundle.filename, copiedBuffer, 'application/zip');
  };

  const handleExportDatasheetPdf = () => {
    const res = generateTechnicalDatasheetPdf({
      title: sketchTitle,
      board: selectedBoard,
      framework,
      code,
      explanation,
      wiring,
      libraries,
      baudRate,
    });
    setLastSavedLabel(`Exported ${res.filename}`);
  };

  const openMonitorOnPortRef = useRef<(port: SerialPort, baud: number) => Promise<void>>(async () => {});

  const scheduleReconnect = useCallback(
    (baud: number, attempt = 1) => {
      if (
        manualDisconnectRef.current ||
        isFlashingRef.current ||
        !autoReconnectRef.current
      ) {
        setReconnecting(false);
        return;
      }

      setReconnecting(true);
      if (attempt === 1) {
        appendLog('system', 'USB serial disconnected. Waiting to auto-reconnect...');
      }

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = window.setTimeout(async () => {
        if (manualDisconnectRef.current || isFlashingRef.current || !autoReconnectRef.current) {
          setReconnecting(false);
          return;
        }
        try {
          const port = await findAuthorizedEspPort(lastPortInfoRef.current);
          if (port) {
            serialPortRef.current = port;
            await openMonitorOnPortRef.current(port, baud);
            setReconnecting(false);
            appendLog('system', `Auto-reconnected USB serial port @ ${baud} baud.`);
            return;
          }
        } catch {
          // Port may still be enumerating after ESP reset; retry below
        }

        if (attempt < 8) {
          scheduleReconnect(baud, attempt + 1);
        } else {
          setReconnecting(false);
          appendLog('system', 'Auto-reconnect timed out. Click Connect USB ESP Board when ready.');
        }
      }, Math.min(2500, 700 + attempt * 250));
    },
    [appendLog]
  );

  const openMonitorOnPort = useCallback(
    async (port: SerialPort, baud: number) => {
      rxBufferRef.current = '';
      rxBytesRef.current = [];
      manualDisconnectRef.current = false;
      try {
        lastPortInfoRef.current = port.getInfo();
      } catch {
        // ignore getInfo failures
      }

      const session = await openSerialMonitorSession(
        port,
        baud,
        (chunk, rawBytes) => {
          rxBufferRef.current += chunk;
          rxBytesRef.current.push(...Array.from(rawBytes));

          if (rxBufferRef.current.includes('\n') || rxBufferRef.current.includes('\r')) {
            const parts = rxBufferRef.current.split(/\r?\n/);
            rxBufferRef.current = parts.pop() ?? '';
            const frameBytes = rxBytesRef.current;
            rxBytesRef.current = [];
            parts.forEach((line, idx) => {
              if (line.length > 0) {
                appendLog('rx', line, idx === 0 ? frameBytes : Array.from(textEncoder.encode(line + '\n')));
              }
            });
          } else if (rxBytesRef.current.length >= 64) {
            // Flush non-newline binary packets directly so Hex View shows binary telemetry
            const frameBytes = rxBytesRef.current;
            const textSnapshot = rxBufferRef.current || `[${frameBytes.length} binary bytes]`;
            rxBytesRef.current = [];
            rxBufferRef.current = '';
            appendLog('rx', textSnapshot, frameBytes);
          }
        },
        (errMsg) => appendLog('error', errMsg),
        () => {
          serialSessionRef.current = null;
          setConnectionMode('disconnected');
          if (!manualDisconnectRef.current && !isFlashingRef.current && autoReconnectRef.current) {
            scheduleReconnect(baud, 1);
          }
        }
      );
      serialSessionRef.current = session;
      setConnectionMode('usb');
      setReconnecting(false);
      appendLog('system', `Connected to USB ESP port @ ${baud} baud.`);
    },
    [appendLog, scheduleReconnect, textEncoder]
  );

  useEffect(() => {
    openMonitorOnPortRef.current = openMonitorOnPort;
  }, [openMonitorOnPort]);

  // Listen to Web Serial hardware connect events for seamless auto-reconnect
  useEffect(() => {
    const cap = checkWebSerialSupport();
    if (!cap.supported) return;

    const handleConnect = (event: Event) => {
      if (!autoReconnectRef.current || manualDisconnectRef.current || isFlashingRef.current) {
        return;
      }
      if (serialSessionRef.current) return;
      const connectedPort = (event as Event & { target?: SerialPort }).target;
      if (connectedPort) {
        serialPortRef.current = connectedPort;
        openMonitorOnPortRef.current(connectedPort, baudRate).catch(() => {});
      }
    };

    navigator.serial.addEventListener('connect', handleConnect);
    return () => {
      navigator.serial.removeEventListener('connect', handleConnect);
    };
  }, [baudRate]);

  const handleConnectUsb = async () => {
    try {
      manualDisconnectRef.current = false;
      setReconnecting(false);
      setVirtualTelemetryActive(false);
      if (serialSessionRef.current) {
        await serialSessionRef.current.close();
        serialSessionRef.current = null;
      }
      const port = await requestEspSerialPort();
      serialPortRef.current = port;
      await openMonitorOnPort(port, baudRate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to open serial port.';
      appendLog('error', msg);
    }
  };

  const handleDisconnect = async () => {
    manualDisconnectRef.current = true;
    setReconnecting(false);
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setVirtualTelemetryActive(false);
    if (serialSessionRef.current) {
      await serialSessionRef.current.close();
      serialSessionRef.current = null;
    }
    setConnectionMode('disconnected');
    appendLog('system', 'Serial connection closed.');
  };

  const handleToggleVirtualMode = () => {
    manualDisconnectRef.current = true;
    setReconnecting(false);
    if (connectionMode === 'virtual') {
      setVirtualTelemetryActive(false);
      setConnectionMode('disconnected');
      appendLog('system', 'Virtual ESP simulation stopped.');
      return;
    }
    if (serialSessionRef.current) {
      serialSessionRef.current.close().catch(() => {});
      serialSessionRef.current = null;
    }
    setConnectionMode('virtual');
    const msg = `Virtual ${selectedBoard.shortName} simulation started. Type "help", "status", "sensor", or "wifi scan".`;
    appendLog('system', msg, Array.from(textEncoder.encode(msg)));
  };

  const handleChangeBaudRate = async (nextBaud: number) => {
    setBaudRate(nextBaud);
    if (connectionMode === 'usb' && serialPortRef.current) {
      try {
        manualDisconnectRef.current = true;
        await serialSessionRef.current?.close();
        serialSessionRef.current = null;
        await openMonitorOnPort(serialPortRef.current, nextBaud);
      } catch (err) {
        appendLog('error', err instanceof Error ? err.message : 'Failed to switch baud rate.');
      }
    }
  };

  const handleSendSerial = async (text: string, lineEnding: LineEnding) => {
    const rawTx = Array.from(textEncoder.encode(text + lineEnding));
    appendLog('tx', text, rawTx);

    if (connectionMode === 'usb' && serialSessionRef.current) {
      try {
        await serialSessionRef.current.writeText(text + lineEnding);
      } catch (err) {
        appendLog('error', err instanceof Error ? err.message : 'Write failed.');
      }
    } else if (connectionMode === 'virtual') {
      const res = processVirtualEspCommand(text, selectedBoard.id, virtualLed);
      if (res.ledState !== undefined) setVirtualLed(res.ledState);
      res.lines.forEach((line) =>
        appendLog('rx', line, Array.from(textEncoder.encode(line + '\n')))
      );
    }
  };

  const handleSendSerialHex = async (bytes: Uint8Array) => {
    const hexPreview = Array.from(bytes)
      .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
      .join(' ');
    appendLog('tx', `HEX: ${hexPreview}`, Array.from(bytes));

    if (connectionMode === 'usb' && serialSessionRef.current) {
      try {
        await serialSessionRef.current.writeBytes(bytes);
      } catch (err) {
        appendLog('error', err instanceof Error ? err.message : 'Hex write failed.');
      }
    } else if (connectionMode === 'virtual') {
      const res = processVirtualEspHexBytes(bytes, selectedBoard.id, virtualLed);
      if (res.ledState !== undefined) setVirtualLed(res.ledState);
      res.textLines.forEach((line, idx) => {
        const frame = res.rawFrames[idx];
        appendLog('rx', line, frame ? Array.from(frame) : undefined);
      });
    }
  };

  const handleResetBoard = async () => {
    if (serialSessionRef.current) {
      await serialSessionRef.current.pulseReset();
      appendLog('system', 'Hardware RTS reset pulse sent.');
    }
  };

  const handleBootloaderMode = async () => {
    if (serialSessionRef.current) {
      await serialSessionRef.current.enterBootloader();
      appendLog('system', 'Bootloader DTR/RTS sequence sent (GPIO0 LOW + Reset).');
    }
  };

  const handleFlashBinary = async (options: {
    files: Array<{ data: Uint8Array; address: number; name: string }>;
    baudRate: number;
    eraseAll: boolean;
  }) => {
    setIsFlashing(true);
    isFlashingRef.current = true;
    setFlashProgress(0);
    try {
      if (serialSessionRef.current) {
        await serialSessionRef.current.close();
        serialSessionRef.current = null;
      }
      const port = serialPortRef.current ?? (await requestEspSerialPort());
      serialPortRef.current = port;

      appendLog(
        'system',
        `Starting flash of ${options.files.map((f) => f.name).join(', ')} at 0x${options.files[0].address.toString(16)}...`
      );

      const { chipName } = await flashFirmwareBinary({
        port,
        baudRate: options.baudRate,
        files: options.files.map((f) => ({ data: f.data, address: f.address })),
        eraseAll: options.eraseAll,
        onLog: (msg) => appendLog('system', msg),
        onProgress: (pct) => setFlashProgress(pct),
      });

      appendLog('system', `Successfully flashed ${chipName}! Opening Serial Monitor...`);
      await openMonitorOnPort(port, baudRate);
    } catch (err) {
      appendLog('error', err instanceof Error ? err.message : 'Firmware flash failed.');
    } finally {
      isFlashingRef.current = false;
      setIsFlashing(false);
    }
  };

  const handleUploadMicroPython = async () => {
    if (connectionMode !== 'usb' || !serialSessionRef.current) {
      appendLog('error', 'Connect a MicroPython USB ESP board first.');
      return;
    }
    try {
      await uploadMicroPythonScript({
        session: serialSessionRef.current,
        code,
        filename: 'main.py',
        onLog: (msg) => appendLog('system', msg),
      });
    } catch (err) {
      appendLog('error', err instanceof Error ? err.message : 'MicroPython upload failed.');
    }
  };

  const appShell = (
    <div
      data-testid="app-viewport-shell"
      data-view-mode={viewMode}
      className={
        isPhoneView
          ? 'w-full max-w-[430px] min-h-screen sm:min-h-[calc(100vh-1.5rem)] flex flex-col bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100 sm:rounded-2xl sm:border sm:border-stone-300 dark:sm:border-stone-800 sm:shadow-xl overflow-x-clip'
          : 'min-h-screen flex flex-col bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100'
      }
    >
      <TopNav
        activeSection={activeSection}
        onNavigate={setActiveSection}
        connectionMode={connectionMode}
        onConnectClick={() => setActiveSection('serial')}
        user={currentUser}
        onAuthClick={() => openAuthModal()}
        isAdmin={isAdmin}
        isPhoneView={isPhoneView}
      />

      <WorkspaceToolbar
        selectedBoard={selectedBoard}
        onSelectBoard={handleSelectBoard}
        framework={framework}
        onSelectFramework={handleSelectFramework}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        onCopyCode={handleCopyCode}
        onExportZip={handleDownloadProjectZip}
        onExportPdf={handleExportDatasheetPdf}
        onOpenSaved={() => setSavedDrawerOpen(true)}
        onOpenPublish={() => setPublishModalState({ open: true })}
        savedCount={savedSketches.length}
        lastSavedLabel={lastSavedLabel}
        copied={copied}
      />

      {siteConfig.announcementEnabled &&
        siteConfig.announcementText &&
        dismissedAnnouncement !== siteConfig.announcementText && (
          <div
            role="status"
            className="border-b border-teal-300 bg-teal-50 text-teal-950 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-100"
          >
            <div
              className={`mx-auto flex max-w-[1440px] items-center justify-between gap-3 py-2 text-xs ${
                isPhoneView ? 'px-3' : 'px-4 sm:px-6'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-400" aria-hidden="true" />
                <span className="font-medium truncate">{siteConfig.announcementText}</span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedAnnouncement(siteConfig.announcementText)}
                aria-label="Dismiss announcement"
                className="rounded p-1 text-teal-700 hover:bg-teal-100 dark:text-teal-300 dark:hover:bg-teal-900/60"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

      <main
        className={`mx-auto w-full max-w-[1440px] flex-1 ${
          isPhoneView ? 'px-3 py-3' : 'px-4 py-4 sm:px-6'
        }`}
      >
        {activeSection === 'studio' && (
          <div className={isPhoneView ? 'space-y-3' : 'space-y-4'}>
            <AiCodeMaker
              board={selectedBoard}
              framework={framework}
              user={currentUser}
              isPhoneView={isPhoneView}
              onRequireAuth={openAuthModal}
              onCodeGenerated={handleAiResult}
            />

            <div
              className={
                isPhoneView
                  ? 'grid grid-cols-1 gap-3 items-start'
                  : 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start'
              }
            >
              <div className={isPhoneView ? '' : 'lg:col-span-7'}>
                <CodeEditorPanel
                  title={sketchTitle}
                  code={code}
                  onChangeCode={setCode}
                  board={selectedBoard}
                  framework={framework}
                  wiring={wiring}
                  libraries={libraries}
                  user={currentUser}
                  isPhoneView={isPhoneView}
                  onRequireAuth={openAuthModal}
                  onAiAssistResult={handleAiResult}
                  onExplainResult={handleAiExplainResult}
                  canUndo={previousCode !== null}
                  onUndoCode={handleUndoCode}
                />
              </div>
              <div className={isPhoneView ? '' : 'lg:col-span-5'}>
                <WiringAndSpecsPanel
                  title={sketchTitle}
                  explanation={explanation}
                  board={selectedBoard}
                  code={code}
                  wiring={wiring}
                  libraries={libraries}
                  warnings={warnings}
                  baudRate={baudRate}
                  onGoToSerial={() => setActiveSection('serial')}
                  onGoToPinout={() => setActiveSection('pinouts')}
                  onGoTo3dPreview={() => setActiveSection('preview3d')}
                  onAddComponent={handleAddComponent}
                  onRemoveWiringRow={handleRemoveWiringRow}
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'preview3d' && (
          <Circuit3dPreview
            title={sketchTitle}
            board={selectedBoard}
            code={code}
            wiring={wiring}
            framework={framework}
            isDark={isDark}
            isPhoneView={isPhoneView}
            onBackToStudio={() => setActiveSection('studio')}
          />
        )}

        {activeSection === 'projects' && (
          <ProjectLibraryView onLoadProject={handleLoadProject} isPhoneView={isPhoneView} />
        )}

        {activeSection === 'community' && (
          <CommunityView
            user={currentUser}
            isAdmin={isAdmin}
            isPhoneView={isPhoneView}
            onOpenAuth={() => openAuthModal()}
            onOpenPublishModal={(sketchToEdit) =>
              setPublishModalState({ open: true, editingSketch: sketchToEdit })
            }
            onLoadCloudSketch={handleLoadCloudSketch}
          />
        )}

        {activeSection === 'admin' && isAdmin && currentUser && (
          <AdminPanelView
            user={currentUser}
            siteConfig={siteConfig}
            isPhoneView={isPhoneView}
            onLoadCloudSketch={handleLoadCloudSketch}
          />
        )}

        {activeSection === 'pinouts' && (
          <PinoutToolsView
            selectedBoard={selectedBoard}
            onSelectBoard={setSelectedBoardId}
            isPhoneView={isPhoneView}
          />
        )}

        {activeSection === 'serial' && (
          <SerialAndUploadView
            board={selectedBoard}
            framework={framework}
            title={sketchTitle}
            code={code}
            connectionMode={connectionMode}
            serialLogs={serialLogs}
            baudRate={baudRate}
            onChangeBaudRate={handleChangeBaudRate}
            onConnectUsb={handleConnectUsb}
            onDisconnect={handleDisconnect}
            onToggleVirtualMode={handleToggleVirtualMode}
            onSendSerial={handleSendSerial}
            onSendSerialHex={handleSendSerialHex}
            onClearLogs={() => setSerialLogs([])}
            onResetBoard={handleResetBoard}
            onBootloaderMode={handleBootloaderMode}
            onFlashBinary={handleFlashBinary}
            flashProgress={flashProgress}
            isFlashing={isFlashing}
            autoReconnect={autoReconnect}
            onToggleAutoReconnect={setAutoReconnect}
            reconnecting={reconnecting}
            onUploadMicroPython={handleUploadMicroPython}
            virtualTelemetryActive={virtualTelemetryActive}
            onToggleVirtualTelemetry={() => setVirtualTelemetryActive((prev) => !prev)}
            onDownloadSketch={handleDownloadSketch}
            onDownloadPlatformIo={handleDownloadPlatformIo}
            onDownloadProjectZip={handleDownloadProjectZip}
            isPhoneView={isPhoneView}
          />
        )}
      </main>

      <SavedSketchesDrawer
        open={savedDrawerOpen}
        onClose={() => setSavedDrawerOpen(false)}
        activeTitle={sketchTitle}
        savedSketches={savedSketches}
        onSaveCurrent={handleSaveCurrentSketch}
        onLoadSaved={handleLoadSavedSketch}
        onRenameSaved={handleRenameSavedSketch}
        onDeleteSaved={handleDeleteSavedSketch}
      />

      <AuthModal
        open={authModalOpen}
        onClose={closeAuthModal}
        user={currentUser}
        reasonMessage={authPromptReason}
        onUserRefreshed={() => {
          setCurrentUser(auth.currentUser);
          setAuthRefreshTick((t) => t + 1);
          if (auth.currentUser?.emailVerified) {
            void syncUserProfile(auth.currentUser).catch(() => {});
          }
        }}
      />

      <PublishSketchModal
        open={publishModalState.open}
        onClose={() => setPublishModalState({ open: false })}
        user={currentUser}
        onOpenAuth={() => openAuthModal()}
        initialTitle={publishModalState.editingSketch?.title ?? sketchTitle}
        initialSummary={publishModalState.editingSketch?.summary ?? explanation}
        initialCode={publishModalState.editingSketch?.code ?? code}
        initialBoardId={publishModalState.editingSketch?.boardId ?? selectedBoardId}
        initialFramework={publishModalState.editingSketch?.framework ?? framework}
        initialTags={publishModalState.editingSketch?.tags ?? []}
        initialVisibility={publishModalState.editingSketch?.visibility ?? 'public'}
        existingSketchId={publishModalState.editingSketch?.id}
        libraries={publishModalState.editingSketch?.libraries ?? libraries}
        wiring={publishModalState.editingSketch?.wiring ?? wiring}
        baudRate={publishModalState.editingSketch?.baudRate ?? baudRate}
        allowPublicPublish={siteConfig.allowNewPublicSketches || isAdmin}
        onPublished={(_sketchId, visibility) => {
          setLastSavedLabel(visibility === 'public' ? 'Published to Community' : 'Saved Privately');
          setActiveSection('community');
        }}
      />

      <footer className="border-t border-stone-300 bg-white py-3 text-xs text-stone-500 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400">
        <div
          className={`mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 ${
            isPhoneView ? 'px-3' : 'px-4 sm:px-6'
          }`}
        >
          <span>Rs-ESP · ESP32 &amp; ESP8266 Workbench</span>
          <span>{BEGINNER_PROJECTS.length} Beginner Projects · Web Serial Flasher &amp; Monitor</span>
        </div>
      </footer>
    </div>
  );

  if (isPhoneView) {
    return (
      <div className="min-h-screen bg-stone-200 dark:bg-stone-900 sm:py-3 flex justify-center">
        {appShell}
      </div>
    );
  }

  return appShell;
}
