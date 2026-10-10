import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, setDoc, doc, getDoc, Timestamp } from "firebase/firestore";
import './App.css';

const firebaseConfig = {
  apiKey: "AIzaSyCT1p8MfDkzLAaT0Tc5uhab66PxkMuMszo",
  authDomain: "nghialam-272.firebaseapp.com",
  databaseURL: "https://nghialam-272.firebaseio.com",
  projectId: "nghialam-272",
  storageBucket: "nghialam-272.firebasestorage.app",
  messagingSenderId: "1008901518626",
  appId: "1:1008901518626:web:b98f838b98258e5c1de17b",
  measurementId: "G-RFKJFQ2QCX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const getTaskKey = (task) => task.alias || task.name;

// SpEL variables that refer to the job itself rather than another task/listener.
const NON_TASK_REFS = new Set(['job', 'input', 'env']);

const extractReferences = (task, knownKeys) => {
  const text = JSON.stringify({
    preCondition: task.preCondition ?? null,
    inputParams: task.inputParams ?? null,
    outputParams: task.outputParams ?? null,
    defaultOutput: task.defaultOutput ?? null,
  });
  const matches = text.match(/#([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
  const refs = new Set();
  matches.forEach((m) => {
    const key = m.slice(1);
    if (NON_TASK_REFS.has(key)) return;
    if (knownKeys.has(key)) refs.add(key);
  });
  return refs;
};

function App() {
  const defaultConfig = {
    name: 'job-name',
    tasks: [],
    listeners: [],
  };

  const [jsonInput, setJsonInput] = useState(
    JSON.stringify(defaultConfig, null, 2)
  );
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [selectedBox, setSelectedBox] = useState(null);
  const [hoveredKey, setHoveredKey] = useState(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const chartFrameRef = useRef(null);
  const chartContentRef = useRef(null);

  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 3;
  const effectiveScale = fitScale * zoomMultiplier;

  // Auto-fit: uniformly scale the diagram (same factor on both axes, so text
  // never distorts) down to whatever fitScale keeps it fully inside the frame.
  // Recomputes whenever the frame (panel open/close, window resize) or the
  // diagram's own natural size (new config, rows wrapping differently) changes.
  useEffect(() => {
    const frame = chartFrameRef.current;
    const content = chartContentRef.current;
    if (!frame || !content) {
      setFitScale(1);
      return;
    }

    const recomputeFit = () => {
      const naturalWidth = content.scrollWidth;
      const naturalHeight = content.scrollHeight;
      const availableWidth = frame.clientWidth;
      const availableHeight = frame.clientHeight;
      if (!naturalWidth || !naturalHeight || !availableWidth || !availableHeight) {
        return;
      }
      setFitScale(Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight));
    };

    recomputeFit();

    const observer = new ResizeObserver(recomputeFit);
    observer.observe(frame);
    observer.observe(content);
    window.addEventListener('resize', recomputeFit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recomputeFit);
    };
  }, [config]);

  // Reset manual zoom whenever a different config is visualized.
  useEffect(() => {
    setZoomMultiplier(1);
  }, [config]);

  const zoomIn = () => setZoomMultiplier((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoomMultiplier((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)));
  const resetZoom = () => setZoomMultiplier(1);

  // Dependency graph built from every task/listener's SpEL expressions:
  // usesMap[key]   = keys this task reads output from (its dependencies)
  // usedByMap[key] = keys that read this task's output (its dependents)
  const { usesMap, usedByMap } = React.useMemo(() => {
    const uses = {};
    const usedBy = {};
    if (!config) return { usesMap: uses, usedByMap: usedBy };

    const allItems = [...(config.tasks || []), ...(config.listeners || [])];
    const knownKeys = new Set(allItems.map(getTaskKey));

    allItems.forEach((item) => {
      const key = getTaskKey(item);
      const refs = extractReferences(item, knownKeys);
      uses[key] = refs;
      refs.forEach((refKey) => {
        if (!usedBy[refKey]) usedBy[refKey] = new Set();
        usedBy[refKey].add(key);
      });
    });

    return { usesMap: uses, usedByMap: usedBy };
  }, [config]);

  const getBoxHighlightClass = (task) => {
    if (!hoveredKey) return '';
    const key = getTaskKey(task);
    if (key === hoveredKey) return 'highlight-self';
    if (usesMap[hoveredKey]?.has(key)) return 'highlight-uses';
    if (usedByMap[hoveredKey]?.has(key)) return 'highlight-used-by';
    return 'dimmed';
  };

  const saveToFirebase = async (config) => {
    try {
      const id = Math.random().toString(36).substr(2, 8);
      const twoDaysLater = Timestamp.fromDate(new Date(Date.now() + 1 * 24 * 60 * 60 * 1000));
      await setDoc(doc(db, "configs", id), {
        config: config,
        createdAt: Timestamp.now(),
        expireAt: twoDaysLater
      });
      return id;
    } catch (e) {
      console.error("Lỗi lưu config:", e);
      return null;
    }
  };

  const loadFromFirebase = async (id) => {
    const docSnap = await getDoc(doc(db, "configs", id));
    if (docSnap.exists()) {
      return docSnap.data().config;
    }
    return null;
  };


  useEffect(() => {
    const id = window.location.hash.substring(1);
    if (id) {
      loadFromFirebase(id).then(config => {
        if (config) {
          setJsonInput(config);
          setConfig(JSON.parse(config));
        }
      });
    }
  }, []);

  const handleVisualize = async () => {
    try {
      const parsed = JSON.parse(jsonInput);

      parsed.tasks =
        parsed.tasks?.map((task) => ({
          ...task,
          order: task.order ?? 0,
        })) || [];

      parsed.listeners =
        parsed.listeners?.map((listener) => ({
          ...listener,
          order: listener.order ?? 0,
        })) || [];

      setConfig(parsed);
      setError('');
    } catch (err) {
      setError('Invalid JSON: ' + err.message);
    }
  };


  const handleShareLink = async () => {
    try {
      const id = await saveToFirebase(jsonInput);
      if (id) {
        console.log(`${window.location.origin}/#${id}`)
        window.location.hash = id;
        navigator.clipboard.writeText(`${window.location.origin}/#${id}`);
      }
    } catch (err) {
      setError('Invalid JSON: ' + err.message);
    }
  };

  const renderTaskBox = (task) => {
    const isDisabled = task.enable === false;
    const key = getTaskKey(task);
    const boxClass = `box ${task.type.toLowerCase()} ${
      isDisabled ? 'disabled' : ''
    } ${selectedBox?.key === key ? 'selected' : ''}`;

    return (
      <div
        key={task.name + (task.alias || '')}
        className={`box-container ${getBoxHighlightClass(task)}`}
        onMouseEnter={() => setHoveredKey(key)}
        onMouseLeave={() => setHoveredKey(null)}
        onClick={() => setSelectedBox({ key, kind: 'Task', data: task })}
      >
        <div className={boxClass}>
          <div className="task-name">{task.name}</div>
          {task.alias && <div className="task-alias">({task.alias})</div>}
          {task.retry && <div className="task-retry">↻ {task.retry.retryCount}</div>}
        </div>
      </div>
    );
  };

  const renderListenerBox = (listener) => {
    const isDisabled = listener.enable === false;
    const key = getTaskKey(listener);
    const boxClass = `box listener-${listener.type.toLowerCase()} ${
      isDisabled ? 'disabled' : ''
    } ${selectedBox?.key === key ? 'selected' : ''}`;

    return (
      <div
        key={listener.name + (listener.alias || '')}
        className={`box-container ${getBoxHighlightClass(listener)}`}
        onMouseEnter={() => setHoveredKey(key)}
        onMouseLeave={() => setHoveredKey(null)}
        onClick={() => setSelectedBox({ key, kind: 'Listener', data: listener })}
      >
        <div className={boxClass}>
          <div className="task-name">{listener.name}</div>
          {listener.alias && <div className="task-alias">({listener.alias})</div>}
          {listener.retry && <div className="task-retry">↻ {listener.retry.retryCount}</div>}
        </div>
      </div>
    );
  };

  const renderGroups = () => {
    if (!config) return null;

    // Group tasks by order (default to 0 if not specified)
    const taskGroups = {};
    config.tasks?.forEach((task) => {
      const order = task.order ?? 0;
      if (!taskGroups[order]) {
        taskGroups[order] = [];
      }
      taskGroups[order].push(task);
    });

    // Group listeners by order (default to 0 if not specified)
    const listenerGroups = {};
    config.listeners?.forEach((listener) => {
      const order = listener.order ?? 0;
      if (!listenerGroups[order]) {
        listenerGroups[order] = [];
      }
      listenerGroups[order].push(listener);
    });

    // Sort orders
    const sortedTaskOrders = Object.keys(taskGroups).sort((a, b) => a - b);
    const sortedListenerOrders = Object.keys(listenerGroups).sort(
      (a, b) => a - b
    );

    return (
      <div
        className="visualization"
        ref={chartContentRef}
        style={{ transform: `scale(${effectiveScale})`, transformOrigin: 'top center' }}
      >
        <div className="tasks-flow">
          {sortedTaskOrders.map((order, index) => (
            <React.Fragment key={'task-' + order}>
              <div className="order-frame">
                <div className="order-label">Order {order}</div>
                <div className="task-group">
                  {taskGroups[order].map((task) => renderTaskBox(task))}
                </div>
              </div>
              {index < sortedTaskOrders.length - 1 && (
                <div className="arrow-container">
                  <div className="arrow-down"></div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {config.listeners && config.listeners.length > 0 && (
          <div className="listeners-section">
            <h3>Listeners</h3>
            <div className="listeners-flow">
              {sortedListenerOrders.map((order, index) => (
                <React.Fragment key={'listener-' + order}>
                  <div className="order-frame">
                    <div className="order-label">Order {order}</div>
                    <div className="listener-group">
                      {listenerGroups[order].map((listener) =>
                        renderListenerBox(listener)
                      )}
                    </div>
                  </div>
                  {index < sortedListenerOrders.length - 1 && (
                    <div className="arrow-container">
                      <div className="arrow-down"></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`app ${selectedBox ? 'with-panel' : ''}`}>
      <h1>Job Configuration Visualizer</h1>
      <div className="input-area">
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          rows={25}
          cols={80}
          placeholder="Paste your job configuration JSON here"
        />
        <button onClick={handleVisualize}>Visualize</button>
        <button onClick={handleShareLink}>Share</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="layout">
        <div className="chart-section">
          {config && (
            <div className="chart-header">
              <h2>Job: {config.name}</h2>
              <div className="zoom-controls">
                <button onClick={zoomOut} disabled={zoomMultiplier <= MIN_ZOOM} title="Zoom out">
                  −
                </button>
                <button className="zoom-reset" onClick={resetZoom} title="Reset to fit screen">
                  {Math.round(effectiveScale * 100)}%
                </button>
                <button onClick={zoomIn} disabled={zoomMultiplier >= MAX_ZOOM} title="Zoom in">
                  +
                </button>
              </div>
            </div>
          )}
          <div
            className="chart-frame"
            ref={chartFrameRef}
          >
            {renderGroups()}
          </div>
        </div>

        {selectedBox && (
          <div className="detail-panel">
            <div className="detail-panel-header">
              <div>
                <span className="detail-panel-kind">{selectedBox.kind}</span>
                <span className="detail-panel-name">{selectedBox.data.name}</span>
              </div>
              <button
                className="detail-panel-close"
                onClick={() => setSelectedBox(null)}
              >
                ✕
              </button>
            </div>
            <pre className="detail-panel-body">
              {JSON.stringify(selectedBox.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
