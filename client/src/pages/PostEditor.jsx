import { useEffect, useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useNavigate, useParams } from 'react-router-dom';
import api, { parseError } from '../api.js';
import { useAuth } from '../auth.jsx';

const schema = Yup.object({
  title: Yup.string().trim().min(3, 'At least 3 characters').max(120, 'At most 120 characters').required('Required'),
  body: Yup.string().trim().max(10000, 'At most 10,000 characters').required('Required'),
});

export default function PostEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [initial, setInitial] = useState(editing ? null : { title: '', body: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/posts/${id}`)
      .then((res) => {
        const post = res.data.post;
        if (post.author.id !== user.id) return setError('You can only edit your own posts.');
        setInitial({ title: post.title, body: post.body });
      })
      .catch((err) => setError(parseError(err).message));
  }, [editing, id, user.id]);

  if (error && !initial) return <p className="alert" role="alert">{error}</p>;
  if (!initial) return <p className="state">Loading…</p>;

  return (
    <div className="panel">
      <h1>{editing ? 'Edit post' : 'New post'}</h1>
      <Formik
        initialValues={initial}
        validationSchema={schema}
        onSubmit={async (values, { setSubmitting, setErrors }) => {
          setError('');
          try {
            const payload = { title: values.title.trim(), body: values.body.trim() };
            const res = editing ? await api.put(`/posts/${id}`, payload) : await api.post('/posts', payload);
            navigate(`/posts/${res.data.post.id}`);
          } catch (err) {
            const { message, fields } = parseError(err);
            setErrors(fields);
            if (!Object.keys(fields).length) setError(message);
            setSubmitting(false);
          }
        }}
      >
        {({ isSubmitting, values }) => (
          <Form noValidate>
            {error && <p className="alert" role="alert">{error}</p>}
            <div className="field">
              <label htmlFor="title">Title</label>
              <Field id="title" name="title" placeholder="A clear, specific title" maxLength={120} />
              <ErrorMessage name="title" component="div" className="field-error" />
            </div>
            <div className="field">
              <label htmlFor="body">Post</label>
              <Field as="textarea" id="body" name="body" rows={10} placeholder="Write something…" />
              <div className="hint">{values.body.length.toLocaleString()} / 10,000</div>
              <ErrorMessage name="body" component="div" className="field-error" />
            </div>
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
              <button className="btn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Publish'}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
}
