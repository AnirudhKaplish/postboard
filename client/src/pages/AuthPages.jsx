import { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { parseError } from '../api.js';

function TextField({ label, name, ...props }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <Field id={name} name={name} {...props} />
      <ErrorMessage name={name} component="div" className="field-error" />
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const from = location.state?.from || '/';

  if (user) return <Navigate to={from} replace />;

  return (
    <div className="panel narrow">
      <h1>Welcome back</h1>
      <Formik
        initialValues={{ identifier: '', password: '' }}
        validationSchema={Yup.object({
          identifier: Yup.string().trim().required('Required'),
          password: Yup.string().required('Required'),
        })}
        onSubmit={async (values, { setSubmitting }) => {
          setError('');
          try {
            await login(values.identifier, values.password);
            navigate(from, { replace: true });
          } catch (err) {
            setError(parseError(err).message);
            setSubmitting(false);
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form noValidate>
            {error && <p className="alert" role="alert">{error}</p>}
            <TextField label="Username or email" name="identifier" autoComplete="username" />
            <TextField label="Password" name="password" type="password" autoComplete="current-password" />
            <button className="btn btn-block" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Logging in…' : 'Log in'}</button>
          </Form>
        )}
      </Formik>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
    </div>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="panel narrow">
      <h1>Create your account</h1>
      <Formik
        initialValues={{ username: '', email: '', password: '' }}
        validationSchema={Yup.object({
          username: Yup.string().trim().min(3, 'At least 3 characters').max(30, 'At most 30 characters')
            .matches(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only').required('Required'),
          email: Yup.string().trim().email('Invalid email address').required('Required'),
          password: Yup.string().min(8, 'At least 8 characters').required('Required'),
        })}
        onSubmit={async (values, { setSubmitting, setErrors }) => {
          setError('');
          try {
            await register(values);
            navigate('/', { replace: true });
          } catch (err) {
            const { message, fields } = parseError(err);
            setErrors(fields);
            if (!Object.keys(fields).length) setError(message);
            setSubmitting(false);
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form noValidate>
            {error && <p className="alert" role="alert">{error}</p>}
            <TextField label="Username" name="username" autoComplete="username" />
            <TextField label="Email" name="email" type="email" autoComplete="email" />
            <TextField label="Password" name="password" type="password" autoComplete="new-password" />
            <button className="btn btn-block" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Sign up'}</button>
          </Form>
        )}
      </Formik>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
