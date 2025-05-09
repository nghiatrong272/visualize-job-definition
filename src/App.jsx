import React, { useState } from 'react';
import './App.css';

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

  const handleVisualize = () => {
    try {
      const parsed = JSON.parse(jsonInput);

      // Set default order to 0 if not specified
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

  const renderTaskBox = (task) => {
    const isDisabled = task.enable === false;
    const boxClass = `box ${task.type.toLowerCase()} ${
      isDisabled ? 'disabled' : ''
    }`;

    let tooltipContent = `Type: ${task.type}\nEnabled: ${task.enable}\nOrder: ${
      task.order ?? 0
    }`;
    if (task.expression) tooltipContent += `\nExpression: ${task.expression}`;
    if (task.inputParameters)
      tooltipContent += `\nInput: ${JSON.stringify(task.inputParameters)}`;
    if (task.retry) tooltipContent += `\nRetry: ${task.retry.retryCount} times`;

    return (
      <div
        key={task.name + (task.alias || '')}
        className={boxClass}
        title={tooltipContent}
      >
        <div className="task-name">{task.name}</div>
        {task.alias && <div className="task-alias">({task.alias})</div>}
        {task.retry && (
          <div className="task-retry">↻ {task.retry.retryCount}</div>
        )}
      </div>
    );
  };

  const renderListenerBox = (listener) => {
    const isDisabled = listener.enable === false;
    const boxClass = `box listener-${listener.type.toLowerCase()} ${
      isDisabled ? 'disabled' : ''
    }`;

    const tooltipContent = `Type: ${listener.type}\nEnabled: ${
      listener.enable
    }\nOrder: ${listener.order ?? 0}\nInput: ${JSON.stringify(
      listener.inputParameters
    )}`;

    return (
      <div
        key={listener.name + (listener.alias || '')}
        className={boxClass}
        title={tooltipContent}
      >
        <div className="task-name">{listener.name}</div>
        {listener.alias && <div className="task-alias">({listener.alias})</div>}
        <div className="listener-label">Listener</div>
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
      </div>
      {error && <div className="error">{error}</div>}
      {renderGroups()}
    </div>
  );
}

export default App;
