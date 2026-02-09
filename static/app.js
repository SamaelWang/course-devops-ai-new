import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const GUEST = new URLSearchParams(window.location.search).get('guest') === '1';
let auth = null;
let db = null;
if (!GUEST) {
  const cfg = await fetch('/firebase-config').then(r => r.json());
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    console.error('Firebase config missing. Set FIREBASE_* env vars on the server.');
  } else {
    const app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
  }
}

const authView = document.getElementById('auth');
const chatView = document.getElementById('chat');
const userSpan = document.getElementById('user');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messages = document.getElementById('messages');
const questionInput = document.getElementById('question');
const sendBtn = document.getElementById('sendBtn');
const nowTs = () => new Date().toLocaleTimeString();
const renderUserMsg = (text, ts) => {
  const wrap = document.createElement('div');
  wrap.className = 'msg user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const t = document.createElement('div');
  t.className = 'text';
  t.textContent = text;
  const m = document.createElement('div');
  m.className = 'meta';
  m.textContent = ts || nowTs();
  bubble.appendChild(t);
  bubble.appendChild(m);
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
};
const renderBotMsg = (text, ts) => {
  const wrap = document.createElement('div');
  wrap.className = 'msg bot';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = 'AI';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const t = document.createElement('div');
  t.className = 'text';
  t.textContent = text;
  const m = document.createElement('div');
  m.className = 'meta';
  m.textContent = ts || nowTs();
  bubble.appendChild(t);
  bubble.appendChild(m);
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
};
const renderBotLoading = () => {
  const wrap = document.createElement('div');
  wrap.className = 'msg bot loading';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = 'AI';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const t = document.createElement('div');
  t.className = 'text';
  t.innerHTML = '<span class="spinner"></span>正在生成...';
  const m = document.createElement('div');
  m.className = 'meta';
  m.textContent = nowTs();
  bubble.appendChild(t);
  bubble.appendChild(m);
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return { wrap, bubble, t };
};
const typeText = async (el, text) => {
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    await new Promise(r => setTimeout(r, 8));
  }
};


const saveChat = async (question, answer, error) => {
  if (GUEST || !auth || !auth.currentUser || !db) return;
  const uid = auth.currentUser.uid;
  const col = collection(db, 'users', uid, 'chats');
  const payload = { question, answer: answer || '', error: error || '', createdAt: serverTimestamp() };
  try { await addDoc(col, payload); } catch {}
};

const MIN_PASSWORD_LENGTH = 6;
const authErrorEl = document.getElementById('auth-error');
const signinBtn = document.getElementById('signin');
const signupBtn = document.getElementById('signup');

function showAuthError(msg) {
  authErrorEl.textContent = msg || '';
  authErrorEl.classList.toggle('visible', !!msg);
}

function authErrorMessage(code) {
  const map = {
    'auth/invalid-email': '请输入有效的邮箱地址',
    'auth/user-disabled': '该账号已被禁用',
    'auth/user-not-found': '未找到该邮箱对应的账号，请先注册',
    'auth/wrong-password': '密码错误',
    'auth/invalid-credential': '邮箱或密码错误',
    'auth/email-already-in-use': '该邮箱已被注册，请直接登录',
    'auth/weak-password': `密码至少需要 ${MIN_PASSWORD_LENGTH} 位`,
    'auth/operation-not-allowed': '当前未开放注册/登录，请联系管理员',
    'auth/too-many-requests': '尝试次数过多，请稍后再试',
    'auth/network-request-failed': '网络错误，请检查网络后重试',
  };
  return map[code] || (code ? `登录失败：${code}` : '请填写邮箱和密码');
}

async function doSignIn() {
  if (!auth) {
    showAuthError('登录服务未配置，请检查服务器环境变量或使用 ?guest=1 游客模式');
    return;
  }
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  showAuthError('');
  if (!email || !password) {
    showAuthError('请填写邮箱和密码');
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    showAuthError(authErrorMessage('auth/weak-password'));
    return;
  }
  signinBtn.disabled = true;
  signupBtn.disabled = true;
  signinBtn.textContent = '登录中...';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showAuthError('');
  } catch (err) {
    showAuthError(authErrorMessage(err.code || ''));
  } finally {
    signinBtn.disabled = false;
    signupBtn.disabled = false;
    signinBtn.textContent = '登录';
  }
}

async function doSignUp() {
  if (!auth) {
    showAuthError('注册服务未配置，请检查服务器环境变量或使用 ?guest=1 游客模式');
    return;
  }
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  showAuthError('');
  if (!email || !password) {
    showAuthError('请填写邮箱和密码');
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    showAuthError(authErrorMessage('auth/weak-password'));
    return;
  }
  signinBtn.disabled = true;
  signupBtn.disabled = true;
  signupBtn.textContent = '注册中...';
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showAuthError('');
  } catch (err) {
    showAuthError(authErrorMessage(err.code || ''));
  } finally {
    signinBtn.disabled = false;
    signupBtn.disabled = false;
    signupBtn.textContent = '注册';
  }
}

document.getElementById('signin').addEventListener('click', doSignIn);
document.getElementById('signup').addEventListener('click', doSignUp);

document.getElementById('signout').addEventListener('click', async () => {
  if (GUEST) return;
  await signOut(auth);
});

if (GUEST) {
  userSpan.textContent = 'Guest';
  authView.classList.add('hidden');
  chatView.classList.remove('hidden');
  document.getElementById('signout').style.display = 'none';
} else if (auth) {
  onAuthStateChanged(auth, user => {
    if (user) {
      userSpan.textContent = user.email || user.uid;
      authView.classList.add('hidden');
      chatView.classList.remove('hidden');
      loadHistory();
    } else {
      userSpan.textContent = '';
      chatView.classList.add('hidden');
      authView.classList.remove('hidden');
      messages.innerHTML = '';
    }
  });
} else {
  authView.classList.remove('hidden');
  chatView.classList.add('hidden');
}

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = questionInput.value.trim();
  if (!q) return;
  renderUserMsg(q);
  questionInput.value = '';
  sendBtn.disabled = true;
  sendBtn.textContent = '发送中...';
  questionInput.disabled = true;
  const { wrap, bubble, t } = renderBotLoading();
  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    const body = Array.isArray(data) ? (data[0] || {}) : data;
    const text = body.answer || body.error || '请求失败';
    wrap.classList.remove('loading');
    await typeText(t, text);
    await saveChat(q, body.answer || '', body.error || '');
  } catch (err) {
    wrap.classList.remove('loading');
    const msg = '请求错误';
    t.textContent = msg;
    await saveChat(q, '', msg);
  }
  sendBtn.disabled = false;
  sendBtn.textContent = '发送';
  questionInput.disabled = false;
});
const loadHistory = async () => {
  if (!auth || !auth.currentUser || !db) return;
  messages.innerHTML = '';
  const uid = auth.currentUser.uid;
  const col = collection(db, 'users', uid, 'chats');
  const q = query(col, orderBy('createdAt', 'asc'), limit(100));
  try {
    const snap = await getDocs(q);
    snap.forEach(doc => {
      const d = doc.data() || {};
      const ts = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleTimeString() : nowTs();
      if (d.question) renderUserMsg(d.question, ts);
      const text = d.answer || d.error || '';
      if (text) renderBotMsg(text, ts);
    });
  } catch {}
};