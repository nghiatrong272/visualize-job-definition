import React, { useState, useEffect } from 'react';
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
    const boxClass = `box ${task.type.toLowerCase()} ${
      isDisabled ? 'disabled' : ''
    }`;

    return (
      <div key={task.name + (task.alias || '')} className="box-container">
        <div className={boxClass}>
          <div className="task-name">{task.name}</div>
          {task.alias && <div className="task-alias">({task.alias})</div>}
          {task.retry && <div className="task-retry">↻ {task.retry.retryCount}</div>}
        </div>
        <div className="json-tooltip">
          <pre>{JSON.stringify(task, null, 2)}</pre>
        </div>
      </div>
    );
  };

  const renderListenerBox = (listener) => {
    const isDisabled = listener.enable === false;
    const boxClass = `box listener-${listener.type.toLowerCase()} ${
      isDisabled ? 'disabled' : ''
    }`;

    return (
      <div key={listener.name + (listener.alias || '')} className="box-container">
        <div className={boxClass}>
          <div className="task-name">{listener.name}</div>
          {listener.alias && <div className="task-alias">({listener.alias})</div>}
          {listener.retry && <div className="task-retry">↻ {listener.retry.retryCount}</div>}
        </div>
        <div className="json-tooltip">
          <pre>{JSON.stringify(listener, null, 2)}</pre>
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
      <div className="visualization">
        <h2>Job: {config.name}</h2>

        <div className="tasks-flow">
          {sortedTaskOrders.map((order, index) => (
            <React.Fragment key={'task-' + order}>
              <div className="task-group">
                {taskGroups[order].map((task) => renderTaskBox(task))}
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
                  <div className="listener-group">
                    {listenerGroups[order].map((listener) =>
                      renderListenerBox(listener)
                    )}
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
    <div className="app">
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
      {renderGroups()}
    </div>
  );
}

export default App;
