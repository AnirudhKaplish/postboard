import { useState } from 'react';
import api, { parseError } from '../api.js';

const SENTIMENT = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative', mixed: 'Mixed' };

export default function SummaryPanel({ postId, refreshKey }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: '' });

  const run = async () => {
    setState({ status: 'loading', data: null, error: '' });
    try {
      const res = await api.post(`/posts/${postId}/summary`);
      setState({ status: 'done', data: res.data.summary, error: '' });
    } catch (err) {
      setState({ status: 'error', data: null, error: parseError(err).message });
    }
  };

  const { status, data, error } = state;

  return (
    <section className="summary" aria-live="polite" data-refresh={refreshKey}>
      <div className="summary-head">
        <button className="btn btn-ghost" onClick={run} disabled={status === 'loading'}>
          ✨ {status === 'loading' ? 'Summarizing…' : data ? 'Summarize again' : 'Summarize this discussion'}
        </button>
        {data && <span className="muted small">AI generated · {data.cached ? 'cached' : 'fresh'}</span>}
      </div>

      {status === 'error' && <p className="alert" role="alert">{error}</p>}

      {data && (
        <div className="summary-body">
          <p>{data.summary}</p>
          {data.keyPoints.length > 0 && (
            <>
              <h3>Key points</h3>
              <ul>{data.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
            </>
          )}
          {data.openQuestions.length > 0 && (
            <>
              <h3>Open questions</h3>
              <ul>{data.openQuestions.map((k) => <li key={k}>{k}</li>)}</ul>
            </>
          )}
          <p className="muted small">Overall tone: <strong>{SENTIMENT[data.sentiment]}</strong>. AI summaries can be wrong, so check the thread.</p>
        </div>
      )}
    </section>
  );
}
