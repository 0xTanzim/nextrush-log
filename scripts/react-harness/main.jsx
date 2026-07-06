import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LoggerProvider, useLogger } from '@nextrush/log/react';
import { configure, disableLogging, log } from '@nextrush/log';

function captureConsole(fn) {
  const captured = [];
  const originals = { log: console.log, info: console.info, debug: console.debug, warn: console.warn, error: console.error };
  for (const level of Object.keys(originals)) {
    console[level] = (...args) => { captured.push(args.map(String).join(' ')); };
  }
  try {
    fn();
  } finally {
    Object.assign(console, originals);
  }
  return captured;
}

function ChildComponent() {
  const childLogger = useLogger('ChildComponent');
  // Log during initial render (synchronous) — this happens BEFORE the
  // provider's useEffect(() => configure(globalConfig)) has run, which is
  // the exact timing gotcha the docs call out.
  useEffect(() => {
    childLogger.info('ChildComponent mounted');
  }, [childLogger]);

  return React.createElement('div', { id: 'child' }, 'child rendered');
}

function App() {
  const [results, setResults] = useState([]);
  const [ran, setRan] = useState(false);
  const providerLogger = useLogger('App');

  function check(name, condition) {
    setResults((prev) => [...prev, { name, pass: !!condition }]);
  }

  useEffect(() => {
    if (ran) return;
    setRan(true);

    // Give the LoggerProvider's own useEffect(configure) a tick to run first,
    // matching real React commit-then-effect ordering.
    queueMicrotask(() => {
      // Scenario A: useLogger()-obtained logger created inside the provider
      // logs normally before any disable.
      const beforeDisable = captureConsole(() => providerLogger.info('before disable via useLogger'));
      check('React: useLogger() logger logs before disable', beforeDisable.length > 0);

      // Scenario B: disableLogging() from a plain event-handler-style call
      // (simulating a real "kill switch" button click) must silence BOTH
      // the useLogger()-obtained logger and the plain `log` singleton.
      disableLogging();

      const afterDisableProvider = captureConsole(() => providerLogger.info('after disable via useLogger — must be silent'));
      check('React: useLogger() logger is silenced by disableLogging()', afterDisableProvider.length === 0);

      const afterDisableDefault = captureConsole(() => log.info('after disable via default log — must be silent'));
      check('React: default `log` singleton is silenced by disableLogging()', afterDisableDefault.length === 0);

      // Scenario C: re-enable via configure(), as a real app's "settings toggle" would.
      configure({ enabled: true });
      const afterReenable = captureConsole(() => providerLogger.info('after re-enable'));
      check('React: re-enabling via configure({enabled:true}) restores logging', afterReenable.length > 0);

      window.__reactTestResults = results.concat([
        { name: 'React: useLogger() logger logs before disable', pass: beforeDisable.length > 0 },
        { name: 'React: useLogger() logger is silenced by disableLogging()', pass: afterDisableProvider.length === 0 },
        { name: 'React: default `log` singleton is silenced by disableLogging()', pass: afterDisableDefault.length === 0 },
        { name: 'React: re-enabling via configure({enabled:true}) restores logging', pass: afterReenable.length > 0 },
      ]);
      window.__reactTestsComplete = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ran, providerLogger]);

  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'React harness'),
    React.createElement(ChildComponent, null),
    React.createElement('div', { id: 'status' }, window.__reactTestsComplete ? 'complete' : 'running'),
  );
}

function Root() {
  const [globalConfig] = useState({ enabled: true, minLevel: 'trace' });

  return React.createElement(
    LoggerProvider,
    { context: 'react-harness', globalConfig },
    React.createElement(App, null),
  );
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(Root, null));
