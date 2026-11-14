// Firebase layer. Exposes window.Cloud and resolves window.cloudReady once auth state is known.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, browserLocalPersistence, setPersistence }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, limit, where, getCountFromServer, runTransaction }
  from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCC8WZZhiMyHwJqxacf5JinUWuggvWywFM",
  authDomain: "perceivle.firebaseapp.com",
  projectId: "perceivle",
  storageBucket: "perceivle.firebasestorage.app",
  messagingSenderId: "46192797196",
  appId: "1:46192797196:web:7b7d764e2be43d00033029",
  measurementId: "G-FLF7RG6GW0"
};
const app = initializeApp(firebaseConfig);
isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
const auth = getAuth(app), db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

const EMAIL = n => `${n.toLowerCase()}@players.perceivle.app`;
const NAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;
const errMsg = e => {
  const c = (e && e.code) || '';
  if (c.includes('email-already-in-use')) return 'That username is taken.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Wrong username or password.';
  if (c.includes('weak-password')) return 'Password needs at least 6 characters.';
  if (c.includes('popup-closed')) return 'Google sign-in was closed.';
  if (c.includes('operation-not-allowed')) return 'This sign-in method is not enabled yet.';
  if (c.includes('network')) return 'Network error. Check your connection.';
  return (e && e.message) || 'Something went wrong.';
};

let readyResolve; window.cloudReady = new Promise(r => readyResolve = r);
let firstState = true;

async function nameFree(n) { const s = await getDoc(doc(db, 'usernames', n.toLowerCase())); return !s.exists(); }
async function claimName(uid, n) {
  const ref = doc(db, 'usernames', n.toLowerCase());
  await runTransaction(db, async tx => { const s = await tx.get(ref); if (s.exists() && s.data().uid !== uid) throw { code: 'email-already-in-use' }; tx.set(ref, { uid, name: n }); });
}

const Cloud = {
  ok: true, user: null, NAME_RE, errMsg,
  async loadProfile(uid) { const s = await getDoc(doc(db, 'users', uid)); return s.exists() ? s.data() : null; },
  async saveProfile(uid, u, leader) {
    await setDoc(doc(db, 'users', uid), u);
    if (leader && u.name) await setDoc(doc(db, 'leaders', uid), leader);
  },
  async register(name, pass) {
    if (!NAME_RE.test(name)) throw { message: 'Usernames are 3–20 letters, numbers, _ . or -' };
    if (!(await nameFree(name))) throw { code: 'email-already-in-use' };
    const cr = await createUserWithEmailAndPassword(auth, EMAIL(name), pass);
    await claimName(cr.user.uid, name);
    return cr.user;
  },
  async login(name, pass) { return (await signInWithEmailAndPassword(auth, EMAIL(name), pass)).user; },
  async google() { return (await signInWithPopup(auth, new GoogleAuthProvider())).user; },
  async setName(uid, name, old) {
    if (!NAME_RE.test(name)) throw { message: 'Usernames are 3–20 letters, numbers, _ . or -' };
    if (old && old.toLowerCase() === name.toLowerCase()) { await claimName(uid, name); return; }
    await claimName(uid, name);
    if (old) { try { await deleteDoc(doc(db, 'usernames', old.toLowerCase())); } catch (e) {} }
  },
  async logout() { await signOut(auth); },
  async submitDaily(n, uid, rec) {
    const ref = doc(db, 'dailies', String(n), 'scores', uid);
    const s = await getDoc(ref); if (s.exists()) return false;
    await setDoc(ref, rec); return true;
  },
  async dailyScores(n) {
    const s = await getDocs(query(collection(db, 'dailies', String(n), 'scores'), orderBy('total', 'desc'), limit(3000)));
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async leaders(n = 100) {
    const s = await getDocs(query(collection(db, 'leaders'), orderBy('rating', 'desc'), limit(n)));
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async rankOf(rating) {
    const [a, b] = await Promise.all([getCountFromServer(query(collection(db, 'leaders'), where('rating', '>', rating))), getCountFromServer(collection(db, 'leaders'))]);
    return { rank: a.data().count + 1, of: Math.max(b.data().count, a.data().count + 1) };
  },
};
window.Cloud = Cloud;

onAuthStateChanged(auth, async user => {
  Cloud.user = user;
  if (firstState) { firstState = false; readyResolve(user); }
  else window.dispatchEvent(new CustomEvent('cloud-auth', { detail: user }));
});
