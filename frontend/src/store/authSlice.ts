import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { User, DemoPersona } from '../types';
import { DEMO_PERSONAS } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  activePersona: DemoPersona | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
}

// Restore session on page load/refresh
export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/auth/me');
      const user = res.data.data;

      // Find matching persona
      const persona = DEMO_PERSONAS.find(
        (p) => p.email.toLowerCase() === user.email.toLowerCase()
      ) || {
        id: user.id,
        name: user.fullName,
        roleTitle: user.role,
        email: user.email,
        role: user.role,
        district: user.district || undefined,
        avatarBadge: user.fullName.substring(0, 2).toUpperCase()
      };

      const token = localStorage.getItem('certiflow_token');
      return { user, token, persona };
    } catch {
      localStorage.removeItem('certiflow_token');
      localStorage.removeItem('certiflow_persona');
      return rejectWithValue('No active session.');
    }
  }
);

export const loginWithCredentials = createAsyncThunk(
  'auth/loginWithCredentials',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data.data;
      localStorage.setItem('certiflow_token', token);

      const persona = DEMO_PERSONAS.find((p) => p.email.toLowerCase() === email.toLowerCase()) || {
        id: user.id,
        name: user.fullName,
        roleTitle: user.role,
        email: user.email,
        role: user.role,
        district: user.district || undefined,
        avatarBadge: user.fullName.substring(0, 2).toUpperCase()
      };

      localStorage.setItem('certiflow_persona', JSON.stringify(persona));
      return { user, token, persona };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Invalid email or password.');
    }
  }
);

export const registerTrainingCentre = createAsyncThunk(
  'auth/registerTrainingCentre',
  async (
    payload: {
      name: string;
      email: string;
      password: string;
      centreName: string;
      centreCode: string;
      state: string;
      district: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await api.post('/auth/signup', payload);
      const { token, user } = res.data.data;
      localStorage.setItem('certiflow_token', token);

      const persona: DemoPersona = {
        id: user.id,
        name: user.fullName,
        roleTitle: 'Training Centre',
        email: user.email,
        role: 'TRAINING_CENTRE',
        district: user.district || undefined,
        avatarBadge: 'TC'
      };

      localStorage.setItem('certiflow_persona', JSON.stringify(persona));
      return { user, token, persona };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed.');
    }
  }
);

export const switchPersona = createAsyncThunk(
  'auth/switchPersona',
  async (persona: DemoPersona, { rejectWithValue }) => {
    try {
      if (persona.role === 'PUBLIC') {
        localStorage.removeItem('certiflow_token');
        localStorage.setItem('certiflow_persona', JSON.stringify(persona));
        try {
          await api.post('/auth/logout');
        } catch {}
        return { user: null, token: null, persona };
      }

      const res = await api.post('/auth/login', {
        email: persona.email,
        password: 'Password@123'
      });

      const { token, user } = res.data.data;
      localStorage.setItem('certiflow_token', token);
      localStorage.setItem('certiflow_persona', JSON.stringify(persona));
      return { user, token, persona };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Login failed for persona');
    }
  }
);

// Initial state restoring from localStorage if available
const storedToken = localStorage.getItem('certiflow_token');
let storedPersona: DemoPersona | null = null;
try {
  const raw = localStorage.getItem('certiflow_persona');
  if (raw) storedPersona = JSON.parse(raw);
} catch {}

const initialState: AuthState = {
  user: null,
  activePersona: storedPersona,
  token: storedToken,
  isAuthenticated: !!storedToken || (storedPersona?.role === 'PUBLIC'),
  loading: !!storedToken, // Show initial loader while verifying /auth/me
  error: null,
  successMessage: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.activePersona = null;
      state.isAuthenticated = false;
      state.error = null;
      state.successMessage = null;
      localStorage.removeItem('certiflow_token');
      localStorage.removeItem('certiflow_persona');
      api.post('/auth/logout').catch(() => {});
    },
    setPublicView(state) {
      state.user = null;
      state.token = null;
      const pubPersona = DEMO_PERSONAS.find((p) => p.role === 'PUBLIC') || null;
      state.activePersona = pubPersona;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.removeItem('certiflow_token');
      if (pubPersona) {
        localStorage.setItem('certiflow_persona', JSON.stringify(pubPersona));
      }
    },
    clearAuthError(state) {
      state.error = null;
      state.successMessage = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Check auth status on refresh
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.activePersona = action.payload.persona;
        state.isAuthenticated = true;
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.loading = false;
        // If it was public view, keep public view
        if (state.activePersona?.role === 'PUBLIC') {
          state.isAuthenticated = true;
        } else {
          state.user = null;
          state.token = null;
          state.activePersona = null;
          state.isAuthenticated = false;
        }
      })
      // Login
      .addCase(loginWithCredentials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithCredentials.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.activePersona = action.payload.persona;
        state.isAuthenticated = true;
      })
      .addCase(loginWithCredentials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Signup
      .addCase(registerTrainingCentre.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerTrainingCentre.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.activePersona = action.payload.persona;
        state.isAuthenticated = true;
      })
      .addCase(registerTrainingCentre.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Switch persona
      .addCase(switchPersona.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(switchPersona.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.activePersona = action.payload.persona;
        state.isAuthenticated = true;
      })
      .addCase(switchPersona.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { logout, setPublicView, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
