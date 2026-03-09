import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  limit,
  startAfter,
  getDocs
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  PlusCircle, 
  PieChart as PieChartIcon, 
  User as UserIcon, 
  LogOut, 
  Sun, 
  Moon, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Search,
  Bell,
  Sparkles,
  ChevronRight,
  X,
  Calendar,
  Filter,
  Award,
  Shield,
  Zap,
  Share2,
  Download,
  Mail,
  Lock,
  Camera,
  Coins,
  Activity,
  Settings,
  Trophy,
  Target,
  UserCheck
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

import { auth, db, OperationType, handleFirestoreError } from './firebase';
import { cn, formatCurrency } from './lib/utils';

// --- Types ---
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  currency: string;
  language: string;
  monthlyBudget: number;
  birthday?: string;
  theme?: string;
  photoURL?: string;
  level?: number;
  xp?: number;
  avatarColor?: string;
  lastCheckIn?: any;
  achievements?: string[];
  createdAt: any;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  date: Date;
  read: boolean;
}

interface Transaction {
  id: string;
  uid: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: any;
  note: string;
  createdAt: any;
}

// --- Constants ---
const EXPENSE_CATEGORIES = ['Ovqat', 'Transport', 'Internet', 'O\'yinlar', 'Boshqa'];
const INCOME_CATEGORIES = ['Oylik', 'Sovg\'a', 'Bonus', 'Boshqa'];
const COLORS = ['#00FFFF', '#FF00FF', '#00FF00', '#FFFF00', '#FF8042'];

// --- Components ---

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorInfo(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="rpg-card p-8 rounded-2xl border-red-500/50 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Tizim xatosi</h2>
          <p className="text-gray-400 mb-6">Nimadir noto'g'ri ketdi. Iltimos, sahifani yangilab ko'ring.</p>
          {errorInfo && (
            <pre className="bg-black/50 p-4 rounded text-xs overflow-auto mb-6 border border-white/10">
              {errorInfo}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition-all"
          >
            Tizimni qayta yuklash
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stats' | 'profile' | 'notifications'>('dashboard');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setTransactions([]);
        setNotifications([]);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Daily Quests and Reminders
  useEffect(() => {
    if (!user) return;
    
    // 24-hour Reminder
    if (transactions.length > 0) {
      const lastTxDate = transactions[0].date instanceof Timestamp 
        ? transactions[0].date.toDate() 
        : new Date(transactions[0].date);
      
      const hoursSinceLastTx = (new Date().getTime() - lastTxDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastTx >= 24) {
        const newNotif: Notification = {
          id: 'reminder-' + new Date().getTime(),
          title: 'Kunlik eslatma',
          message: "Bugungi xarajatlarni qo'shishni unutmang! RPG sarguzashtingizni davom ettiring.",
          date: new Date(),
          read: false
        };
        setNotifications(prev => {
          if (prev.some(n => n.title === 'Kunlik eslatma' && isSameDay(n.date, new Date()))) return prev;
          return [newNotif, ...prev];
        });
      }
    }

    // Daily Quest
    const today = new Date();
    const questId = 'quest-' + format(today, 'yyyy-MM-dd');
    const quests = [
      { title: 'Kunlik topshiriq: Tejamkorlik', message: 'Bugun 100,000 so\'mdan kam xarajat qiling va +50 XP oling!' },
      { title: 'Kunlik topshiriq: Intizom', message: 'Bugun barcha xarajatlaringizga izoh (note) yozib qoldiring!' },
      { title: 'Kunlik topshiriq: Strategiya', message: 'Haftalik byudjetingizni ko\'rib chiqing va AI maslahatini oling!' }
    ];
    const randomQuest = quests[Math.floor(Math.random() * quests.length)];

    setNotifications(prev => {
      if (prev.some(n => n.id.startsWith('quest-') && isSameDay(n.date, today))) return prev;
      return [{
        id: questId,
        title: randomQuest.title,
        message: randomQuest.message,
        date: today,
        read: false
      }, ...prev];
    });
  }, [user, transactions]);

  // Profile Listener
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Create default profile if not exists
        const newProfile: UserProfile = {
          uid: user.uid,
          name: user.displayName || 'User',
          email: user.email || '',
          currency: 'UZS',
          language: 'uz',
          monthlyBudget: 1000000,
          createdAt: serverTimestamp()
        };
        setDoc(doc(db, 'users', user.uid), newProfile);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });
    return unsubscribe;
  }, [user]);

  // Transactions Listener with Pagination
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 20);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'transactions');
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const loadMoreTransactions = async () => {
    if (!user || !lastDoc || loadingMore) return;
    setLoadingMore(true);
    
    try {
      const q = query(
        collection(db, 'transactions'),
        where('uid', '==', user.uid),
        orderBy('date', 'desc'),
        startAfter(lastDoc),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const newTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      if (newTxs.length > 0) {
        setTransactions(prev => [...prev, ...newTxs]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 20);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Dark Mode Toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-cyan-500 rounded-full animate-pulse blur-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <ErrorBoundary>
      <div className="h-[100dvh] bg-zinc-950 flex justify-center overflow-hidden">
        <div className="w-full max-w-md bg-background text-foreground h-full relative shadow-2xl shadow-black/50 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rpg-gradient rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Wallet className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tighter italic">MoneyDay</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-accent transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 rounded-full hover:bg-accent transition-colors"
            >
              <Bell className="w-6 h-6 text-muted-foreground" />
              {notifications.some(n => !n.read) && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-pink-500 rounded-full border-2 border-background"></div>
              )}
            </button>
          </div>
        </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 custom-scrollbar">
          {activeTab === 'dashboard' && (
            <Dashboard 
              profile={profile} 
              transactions={transactions} 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              hasMore={hasMore}
              loadMore={loadMoreTransactions}
              loadingMore={loadingMore}
              filterYear={filterYear}
              setFilterYear={setFilterYear}
              filterMonth={filterMonth}
              setFilterMonth={setFilterMonth}
            />
          )}
          {activeTab === 'stats' && <Statistics transactions={transactions} profile={profile} />}
          {activeTab === 'notifications' && (
            <NotificationsPage 
              notifications={notifications} 
              setNotifications={setNotifications} 
            />
          )}
          {activeTab === 'profile' && <ProfilePage profile={profile} user={user} transactions={transactions} />}
        </main>

          {/* Navigation */}
          <nav className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border p-4 flex justify-around items-center z-50">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard />}
            label="Asosiy"
          />
          <NavButton 
            active={activeTab === 'stats'} 
            onClick={() => setActiveTab('stats')}
            icon={<PieChartIcon />}
            label="Statistika"
          />
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-14 h-14 -mt-10 rpg-gradient rounded-full flex items-center justify-center text-white shadow-xl shadow-purple-500/40 hover:scale-110 active:scale-95 transition-all"
          >
            <PlusCircle className="w-8 h-8" />
          </button>
          <NavButton 
            active={activeTab === 'notifications'} 
            onClick={() => setActiveTab('notifications')}
            icon={<Bell />}
            label="Xabarlar"
            badge={notifications.filter(n => !n.read).length}
          />
          <NavButton 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')}
            icon={profile?.photoURL ? (
              <div className="w-6 h-6 rounded-lg overflow-hidden border border-border">
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <UserIcon />
            )}
            label="Profil"
          />
        </nav>

          {/* Add Transaction Modal */}
          {showAddModal && (
            <TransactionModal 
              onClose={() => setShowAddModal(false)} 
              uid={user.uid} 
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-Components ---

function NavButton({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300 relative",
        active ? "text-cyan-500 scale-110" : "text-muted-foreground"
      )}
    >
      <div className="w-6 h-6">
        {icon}
      </div>
      {badge ? (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full text-[8px] font-black text-white flex items-center justify-center border border-background">
          {badge}
        </div>
      ) : null}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {active && <div className="w-1 h-1 bg-cyan-500 rounded-full mt-1"></div>}
    </button>
  );
}

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        try {
          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, 'users', userCred.user.uid), {
            uid: userCred.user.uid,
            name: name,
            email: email,
            currency: 'UZS',
            language: 'uz',
            monthlyBudget: 1000000,
            createdAt: serverTimestamp()
          });
        } catch (signupErr: any) {
          // Agar email band bo'lsa, shunchaki kirishga harakat qilamiz (seamless login)
          if (signupErr.code === 'auth/email-already-in-use') {
            await signInWithEmailAndPassword(auth, email, password);
          } else {
            throw signupErr;
          }
        }
      }
    } catch (err: any) {
      let message = 'Xatolik yuz berdi. Qaytadan urinib ko\'ring.';
      if (err.code === 'auth/invalid-credential') message = 'Email yoki parol noto\'g\'ri.';
      if (err.code === 'auth/weak-password') message = 'Parol juda kuchsiz (kamida 6 ta belgi).';
      if (err.code === 'auth/user-not-found') message = 'Bunday foydalanuvchi topilmadi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] flex justify-center bg-zinc-950 overflow-hidden">
      <div className="w-full max-w-md bg-black text-foreground h-full relative shadow-2xl shadow-black/50 flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 blur-[120px] rounded-full"></div>

        <div className="w-full z-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 rpg-gradient rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-purple-500/40 mb-4 animate-bounce">
              <Wallet className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter text-white">MoneyDay</h1>
            <p className="text-gray-400 mt-2">Sizning RPG uslubidagi moliyaviy sayohatingiz boshlanadi</p>
          </div>

          <form onSubmit={handleSubmit} className="rpg-card p-8 rounded-3xl space-y-4 border-white/5">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Qahramon ismi</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-all"
                placeholder="Ismingizni kiriting"
                required
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-all"
              placeholder="hero@moneyday.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Maxfiy kalit</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-400 text-xs font-medium text-center">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 rpg-gradient rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Jarayon...' : isLogin ? 'Dunyoga kirish' : 'Qahramon yaratish'}
          </button>

          <p className="text-center text-gray-500 text-sm mt-6">
            {isLogin ? "Yangi qahramonmisiz?" : "Allaqachon qahramonmisiz?"}{' '}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-cyan-400 font-bold hover:underline"
            >
              {isLogin ? 'Ro\'yxatdan o\'tish' : 'Kirish'}
            </button>
          </p>
        </form>
      </div>
    </div>
  </div>
);
}

function Dashboard({ 
  profile, 
  transactions, 
  searchQuery, 
  setSearchQuery,
  hasMore,
  loadMore,
  loadingMore,
  filterYear,
  setFilterYear,
  filterMonth,
  setFilterMonth
}: { 
  profile: UserProfile | null, 
  transactions: Transaction[],
  searchQuery: string,
  setSearchQuery: (q: string) => void,
  hasMore: boolean,
  loadMore: () => void,
  loadingMore: boolean,
  filterYear: string,
  setFilterYear: (y: string) => void,
  filterMonth: string,
  setFilterMonth: (m: string) => void
}) {
  const today = new Date();
  const todayTxs = transactions.filter(tx => {
    const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
    return isSameDay(txDate, today);
  });

  const todayIncome = todayTxs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const todayExpense = todayTxs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  
  const totalIncome = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const balance = totalIncome - totalExpense;

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthExpense = transactions
    .filter(tx => {
      const d = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && tx.type === 'expense';
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const budgetExceeded = profile?.monthlyBudget && monthExpense > profile.monthlyBudget;

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (tx.note?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
    const matchesYear = filterYear === 'Hammasi' || txDate.getFullYear().toString() === filterYear;
    const matchesMonth = filterMonth === 'Hammasi' || (txDate.getMonth() + 1).toString() === filterMonth;
    
    return matchesSearch && matchesYear && matchesMonth;
  });

  const years = ['Hammasi', ...Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())];
  const months = [
    { v: 'Hammasi', l: 'Barcha oylar' },
    { v: '1', l: 'Yanvar' }, { v: '2', l: 'Fevral' }, { v: '3', l: 'Mart' },
    { v: '4', l: 'Aprel' }, { v: '5', l: 'May' }, { v: '6', l: 'Iyun' },
    { v: '7', l: 'Iyul' }, { v: '8', l: 'Avgust' }, { v: '9', l: 'Sentyabr' },
    { v: '10', l: 'Oktyabr' }, { v: '11', l: 'Noyabr' }, { v: '12', l: 'Dekabr' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black italic">Salom, {profile?.name}!</h2>
          <p className="text-muted-foreground text-sm">Moliyaviy holatingiz a'lo darajada.</p>
        </div>
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg border-2 border-background overflow-hidden",
          !profile?.photoURL && (profile?.avatarColor || 'bg-cyan-500')
        )}>
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            profile?.name?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="rpg-gradient p-6 rounded-3xl text-white shadow-2xl shadow-purple-500/30 relative overflow-hidden border border-white/10">
        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Umumiy balans</p>
          <h3 className="text-4xl font-black mt-1">{formatCurrency(balance, profile?.currency)}</h3>
          
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-inner">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Bugungi daromad</span>
              </div>
              <p className="font-bold">{formatCurrency(todayIncome, profile?.currency)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-inner">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-pink-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Bugungi xarajat</span>
              </div>
              <p className="font-bold">{formatCurrency(todayExpense, profile?.currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Warning */}
      {budgetExceeded && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-4 animate-pulse shadow-lg shadow-red-500/5">
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/40">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-red-500">Byudjet limiti oshib ketdi!</h4>
            <p className="text-xs text-red-400/80">Siz bu oy {formatCurrency(monthExpense, profile?.currency)} sarfladingiz. Limit: {formatCurrency(profile?.monthlyBudget || 0, profile?.currency)}</p>
          </div>
        </div>
      )}

      {/* AI Advice Section */}
      <AIAdvice transactions={transactions} profile={profile} />

      {/* Filters & Search */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-300"></div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tranzaksiyalarni qidirish..."
                className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-sm"
              />
            </div>
          </div>
          
          <div className="flex gap-2 no-scrollbar">
            <div className="flex-1 min-w-[80px] relative group">
              <div className="absolute -inset-0.5 bg-cyan-500 rounded-xl blur-[2px] opacity-10 group-hover:opacity-30 transition"></div>
              <div className="relative flex items-center gap-1 bg-accent/40 p-1.5 rounded-xl border border-border/50 hover:border-cyan-500/50 transition-all">
                <Calendar className="w-3 h-3 text-cyan-500" />
                <select 
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full bg-transparent text-[10px] font-black uppercase tracking-tighter focus:outline-none cursor-pointer appearance-none"
                >
                  {years.map(y => <option key={y} value={y} className="bg-[#0a0a0a] text-white">{y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1 min-w-[100px] relative group">
              <div className="absolute -inset-0.5 bg-pink-500 rounded-xl blur-[2px] opacity-10 group-hover:opacity-30 transition"></div>
              <div className="relative flex items-center gap-1 bg-accent/40 p-1.5 rounded-xl border border-border/50 hover:border-pink-500/50 transition-all">
                <Filter className="w-3 h-3 text-pink-500" />
                <select 
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full bg-transparent text-[10px] font-black uppercase tracking-tighter focus:outline-none cursor-pointer appearance-none"
                >
                  {months.map(m => <option key={m.v} value={m.v} className="bg-[#0a0a0a] text-white">{m.l}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Oxirgi harakatlar</h4>
            <span className="text-[10px] font-bold text-cyan-500 px-2 py-0.5 bg-cyan-500/10 rounded-full border border-cyan-500/20">{filteredTransactions.length} ta element</span>
          </div>

          <div className="space-y-3">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(tx => (
                <div key={tx.id} className="rpg-card p-4 rounded-2xl flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-white/5 hover:border-white/10">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg",
                      tx.type === 'income' ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10" : "bg-pink-500/10 text-pink-500 shadow-pink-500/10"
                    )}>
                      {tx.type === 'income' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{tx.category}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{format(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), 'MMM dd, HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-black text-base",
                      tx.type === 'income' ? "text-emerald-500" : "text-pink-500"
                    )}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, profile?.currency)}
                    </p>
                    {tx.note && <p className="text-[10px] text-muted-foreground truncate max-w-[120px] italic">{tx.note}</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 rpg-card rounded-3xl border border-dashed border-border/50">
                <p className="italic text-sm text-muted-foreground">Ushbu vaqt oralig'ida ma'lumot topilmadi.</p>
              </div>
            )}

            {hasMore && searchQuery === '' && filterYear === 'Hammasi' && filterMonth === 'Hammasi' && (
              <button 
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-5 bg-gradient-to-b from-accent/20 to-accent/5 border border-cyan-500/30 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-cyan-500 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all active:scale-95 disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    Ma'lumotlar chaqirilmoqda...
                  </span>
                ) : 'Yana yuklash'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AIAdvice({ transactions, profile }: { transactions: Transaction[], profile: UserProfile | null }) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getAdvice = async () => {
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As a financial RPG guide, analyze my transactions and give me 3 short, punchy tips in Uzbek to save money or improve my financial health. 
        My currency is ${profile?.currency}. 
        My monthly budget is ${profile?.monthlyBudget}.
        My recent transactions: ${JSON.stringify(transactions.slice(0, 10).map(t => ({ type: t.type, amount: t.amount, category: t.category })))}
        Keep it in a cool, RPG-like tone (e.g., "Level up your savings", "Avoid the gold sink"). Use Markdown. Response must be in Uzbek.`,
      });
      const response = await model;
      setAdvice(response.text);
    } catch (err) {
      console.error(err);
      setAdvice("The AI Oracle is currently resting. Try again later!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rpg-card p-5 rounded-3xl border-cyan-500/20 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
        <Sparkles className="w-8 h-8 text-cyan-500 animate-pulse" />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-cyan-500" />
        </div>
        <h4 className="font-black italic text-sm uppercase tracking-widest">AI Moliyaviy Bashorat</h4>
      </div>

      {advice ? (
        <div className="text-sm text-muted-foreground prose prose-invert max-w-none">
          <ReactMarkdown>{advice}</ReactMarkdown>
          <button 
            onClick={() => setAdvice(null)}
            className="mt-4 text-xs font-bold text-cyan-500 hover:underline"
          >
            Maslahatni o'chirish
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground italic">Moliyaviy strategiya kerakmi?</p>
          <button 
            onClick={getAdvice}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-500 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {loading ? 'Maslahatlashilmoqda...' : 'Maslahat olish'}
          </button>
        </div>
      )}
    </div>
  );
}

function Statistics({ transactions, profile }: { transactions: Transaction[], profile: UserProfile | null }) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const today = new Date();
  
  // Daily Stats (Today hourly)
  const todayHours = Array.from({ length: 24 }, (_, i) => {
    const hourTxs = transactions.filter(tx => {
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return isSameDay(txDate, today) && txDate.getHours() === i && tx.type === 'expense';
    });
    return {
      name: `${i}:00`,
      amount: hourTxs.reduce((sum, tx) => sum + tx.amount, 0)
    };
  });

  // Weekly Stats
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    const dayTxs = transactions.filter(tx => {
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return isSameDay(txDate, d) && tx.type === 'expense';
    });
    const dayNames: {[key: string]: string} = {
      'Mon': 'Dush', 'Tue': 'Sesh', 'Wed': 'Chor', 'Thu': 'Pay', 'Fri': 'Jum', 'Sat': 'Shan', 'Sun': 'Yak'
    };
    const enDay = format(d, 'EEE');
    return {
      name: dayNames[enDay] || enDay,
      amount: dayTxs.reduce((sum, tx) => sum + tx.amount, 0)
    };
  });

  // Monthly Stats (Last 6 months)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = subDays(today, (5 - i) * 30);
    const monthTxs = transactions.filter(tx => {
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear() && tx.type === 'expense';
    });
    const monthNames: {[key: string]: string} = {
      'Jan': 'Yan', 'Feb': 'Fev', 'Mar': 'Mar', 'Apr': 'Apr', 'May': 'May', 'Jun': 'Iyun',
      'Jul': 'Iyul', 'Aug': 'Avg', 'Sep': 'Sen', 'Oct': 'Okt', 'Nov': 'Noy', 'Dec': 'Dek'
    };
    const enMonth = format(d, 'MMM');
    return {
      name: monthNames[enMonth] || enMonth,
      amount: monthTxs.reduce((sum, tx) => sum + tx.amount, 0)
    };
  });

  // Yearly Stats (Last 3 years)
  const last3Years = Array.from({ length: 3 }, (_, i) => {
    const d = subDays(today, (2 - i) * 365);
    const yearTxs = transactions.filter(tx => {
      const txDate = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return txDate.getFullYear() === d.getFullYear() && tx.type === 'expense';
    });
    return {
      name: format(d, 'yyyy'),
      amount: yearTxs.reduce((sum, tx) => sum + tx.amount, 0)
    };
  });

  const chartData = timeframe === 'daily' ? todayHours : timeframe === 'weekly' ? last7Days : timeframe === 'monthly' ? last6Months : last3Years;

  // Category Stats
  const categoryData = EXPENSE_CATEGORIES.map(cat => ({
    name: cat,
    value: transactions
      .filter(tx => tx.type === 'expense' && tx.category === cat)
      .reduce((sum, tx) => sum + tx.amount, 0)
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black italic">Statistika</h2>
          <p className="text-muted-foreground text-sm">Moliyaviy sarguzashtingizni kuzating.</p>
        </div>
        <div className="flex p-1 bg-accent rounded-xl gap-1">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tf => (
            <button 
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                timeframe === tf ? "bg-background text-cyan-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tf === 'daily' ? 'Bugun' : tf === 'weekly' ? 'Hafta' : tf === 'monthly' ? 'Oy' : 'Yil'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="rpg-card p-6 rounded-3xl">
        <h4 className="font-bold text-xs uppercase tracking-widest mb-6 text-muted-foreground">
          {timeframe === 'daily' ? 'Bugungi' : timeframe === 'weekly' ? 'Haftalik' : timeframe === 'monthly' ? 'Oylik' : 'Yillik'} xarajatlar
        </h4>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold' }} 
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                itemStyle={{ color: '#00FFFF', fontWeight: 'bold' }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#00FFFF' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Pie Chart */}
      <div className="rpg-card p-6 rounded-3xl">
        <h4 className="font-bold text-xs uppercase tracking-widest mb-6 text-muted-foreground">Xarajatlar taqsimoti</h4>
        <div className="h-[250px] w-full flex items-center justify-center">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground italic text-sm">Ko'rsatish uchun ma'lumot yo'q.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {categoryData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ profile, user, transactions }: { profile: UserProfile | null, user: FirebaseUser, transactions: Transaction[] }) {
  const [name, setName] = useState(profile?.name || '');
  const [budget, setBudget] = useState(profile?.monthlyBudget || 1000000);
  const [currency, setCurrency] = useState(profile?.currency || 'UZS');
  const [language, setLanguage] = useState(profile?.language || 'uz');
  const [birthday, setBirthday] = useState(profile?.birthday || '');
  const [theme, setTheme] = useState(profile?.theme || 'Cyberpunk');
  const [avatarColor, setAvatarColor] = useState(profile?.avatarColor || 'bg-cyan-500');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // RPG Stats
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const nextLevelXp = level * 1000;
  const xpProgress = (xp / nextLevelXp) * 100;

  // Financial Stats
  const totalIncome = transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const balance = totalIncome - totalExpense;

  // Wealth Rank
  const getWealthRank = (bal: number) => {
    if (bal < 1000000) return { name: 'Qashshoq Sarguzashtchi', color: 'text-gray-400' };
    if (bal < 5000000) return { name: 'Oltin Izlovchi', color: 'text-yellow-400' };
    if (bal < 20000000) return { name: 'Boy Savdogar', color: 'text-cyan-400' };
    return { name: 'Afsonaviy Sulton', color: 'text-purple-400' };
  };
  const rank = getWealthRank(balance);

  // Profile Completeness
  const fields = [name, budget, currency, language, birthday, theme, photoURL];
  const completeness = Math.round((fields.filter(f => !!f).length / fields.length) * 100);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        monthlyBudget: Number(budget),
        currency,
        language,
        birthday,
        theme,
        avatarColor,
        photoURL
      });
      alert('Profil muvaffaqiyatli yangilandi!');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit
      alert('Rasm hajmi 1MB dan oshmasligi kerak!');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const claimDailyReward = async () => {
    if (!profile) return;
    
    const lastCheckIn = profile.lastCheckIn instanceof Timestamp ? profile.lastCheckIn.toDate() : profile.lastCheckIn ? new Date(profile.lastCheckIn) : null;
    if (lastCheckIn && isSameDay(lastCheckIn, new Date())) {
      alert('Siz bugungi mukofotni allaqachon olgansiz!');
      return;
    }

    setClaiming(true);
    try {
      const newXp = (profile.xp || 0) + 100;
      let newLevel = profile.level || 1;
      let finalXp = newXp;

      if (finalXp >= newLevel * 1000) {
        finalXp -= newLevel * 1000;
        newLevel += 1;
        alert(`Tabriklaymiz! Siz ${newLevel}-darajaga ko'tarildingiz!`);
      }

      await updateDoc(doc(db, 'users', user.uid), {
        xp: finalXp,
        level: newLevel,
        lastCheckIn: serverTimestamp()
      });
      alert('100 XP mukofot olindi!');
    } catch (err) {
      console.error(err);
    } finally {
      setClaiming(false);
    }
  };

  const exportData = () => {
    const data = JSON.stringify({ profile, transactions }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneyday_export_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  };

  const achievements = [
    { id: 1, name: 'Birinchi qadam', icon: <Zap className="w-4 h-4" />, unlocked: transactions.length > 0, desc: 'Birinchi tranzaksiya qo\'shildi' },
    { id: 2, name: 'Byudjet ustasi', icon: <Shield className="w-4 h-4" />, unlocked: level >= 5, desc: '5-darajaga yetdingiz' },
    { id: 3, name: 'Oltin jamg\'arma', icon: <Award className="w-4 h-4" />, unlocked: balance >= 10000000, desc: '10 mln so\'m jamg\'arildi' },
  ];

  const avatarColors = [
    'bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500', 'bg-yellow-500', 'bg-indigo-500'
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-32 w-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-3xl border border-white/5 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        </div>
        <div className="absolute -bottom-10 left-6 flex items-end gap-4">
          <div className="relative group">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-24 h-24 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-2xl border-4 border-background overflow-hidden transition-all cursor-pointer",
                !photoURL && avatarColor
              )}
            >
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                name.charAt(0).toUpperCase()
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-6 h-6" />
              </div>
            </div>
            {photoURL && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoURL('');
                }}
                className="absolute -top-2 -left-2 w-8 h-8 bg-red-500 rounded-xl border border-background flex items-center justify-center shadow-lg hover:scale-110 transition-all"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-background rounded-2xl border border-border flex items-center justify-center shadow-lg">
              <span className="text-cyan-500 font-black text-sm">Lv.{level}</span>
            </div>
          </div>
          <div className="mb-2">
            <h3 className="text-2xl font-black italic tracking-tighter">{name}</h3>
            <div className="flex items-center gap-2">
              <Trophy className={cn("w-3 h-3", rank.color)} />
              <p className={cn("text-[10px] font-black uppercase tracking-widest", rank.color)}>{rank.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* XP Progress & Daily Reward */}
      <div className="rpg-card p-6 rounded-3xl mt-12 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tajriba (XP)</span>
          </div>
          <span className="text-[10px] font-black text-cyan-500">{xp} / {nextLevelXp} XP</span>
        </div>
        <div className="h-3 bg-accent rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-1000"
            style={{ width: `${xpProgress}%` }}
          ></div>
        </div>
        
        <button 
          onClick={claimDailyReward}
          disabled={claiming}
          className="w-full py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-500 text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Coins className="w-4 h-4" />
          {claiming ? 'Olinmoqda...' : 'Kunlik mukofot (100 XP)'}
        </button>
      </div>

      {/* Profile Completeness */}
      <div className="rpg-card p-5 rounded-3xl border-emerald-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Profil to'liqligi</span>
          <span className="text-[10px] font-black text-emerald-500">{completeness}%</span>
        </div>
        <div className="h-1.5 bg-accent rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-1000"
            style={{ width: `${completeness}%` }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rpg-card p-4 rounded-2xl border-emerald-500/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Muvaffaqiyatlar</p>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-black">{achievements.filter(a => a.unlocked).length} / {achievements.length}</span>
          </div>
        </div>
        <div className="rpg-card p-4 rounded-2xl border-cyan-500/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Tranzaksiyalar</p>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" />
            <span className="text-lg font-black">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Yutuqlar</h4>
          <Trophy className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          {achievements.map(ach => (
            <div key={ach.id} className={cn(
              "rpg-card p-4 rounded-2xl flex items-center gap-4 transition-all",
              ach.unlocked ? "border-emerald-500/30 opacity-100" : "opacity-40 grayscale"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                ach.unlocked ? "bg-emerald-500/10 text-emerald-500" : "bg-accent text-muted-foreground"
              )}>
                {ach.icon}
              </div>
              <div>
                <p className="text-sm font-bold">{ach.name}</p>
                <p className="text-[10px] text-muted-foreground">{ach.desc}</p>
              </div>
              {ach.unlocked && <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Avatar Customization */}
      <div className="rpg-card p-6 rounded-3xl space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Avatar rangi</h4>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {avatarColors.map(color => (
            <button 
              key={color}
              onClick={() => setAvatarColor(color)}
              className={cn(
                "w-10 h-10 rounded-xl shrink-0 border-2 transition-all",
                color,
                avatarColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
              )}
            />
          ))}
        </div>
      </div>

      {/* Settings Form */}
      <div className="rpg-card p-6 rounded-3xl space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sozlamalar</h4>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ko'rinadigan ism</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tug'ilgan kun</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="date" 
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Oylik byudjet limiti</label>
            <div className="relative">
              <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="number" 
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full bg-accent/50 border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Valyuta</label>
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all appearance-none"
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Til</label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all appearance-none"
              >
                <option value="uz">O'zbek</option>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">RPG Mavzusi</label>
            <select 
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all appearance-none"
            >
              <option value="Cyberpunk">Cyberpunk (Neon)</option>
              <option value="Fantasy">Fantasy (Oltin)</option>
              <option value="Minimal">Minimal (Slate)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rpg-gradient rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'O\'zgarishlarni saqlash'}
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={exportData}
              className="py-3 bg-accent/50 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Eksport
            </button>
            <button 
              onClick={() => alert('Parolni o\'zgartirish... (Tez orada)')}
              className="py-3 bg-accent/50 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Xavfsizlik
            </button>
          </div>

          <button 
            onClick={() => signOut(auth)}
            className="w-full py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Chiqish
          </button>
        </div>
      </div>

      {/* Social Links */}
      <div className="rpg-card p-6 rounded-3xl space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Biz bilan bog'laning</h4>
        <div className="flex justify-around">
          <button className="p-3 bg-accent/50 rounded-2xl hover:text-cyan-500 transition-all"><Mail className="w-6 h-6" /></button>
          <button className="p-3 bg-accent/50 rounded-2xl hover:text-cyan-500 transition-all"><Share2 className="w-6 h-6" /></button>
          <button className="p-3 bg-accent/50 rounded-2xl hover:text-cyan-500 transition-all"><Shield className="w-6 h-6" /></button>
        </div>
      </div>
    </div>
  );
}

function TransactionModal({ onClose, uid }: { onClose: () => void, uid: string }) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        uid,
        type,
        amount: Number(amount),
        category: category === 'Others' ? customCategory || 'Others' : category,
        date: Timestamp.fromDate(new Date(date)),
        note,
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full bg-background border border-border rounded-t-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black italic">Tranzaksiya qo'shish</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Toggle */}
          <div className="flex p-1 bg-accent rounded-2xl">
            <button 
              type="button"
              onClick={() => { setType('expense'); setCategory(EXPENSE_CATEGORIES[0]); }}
              className={cn(
                "flex-1 py-3 rounded-xl font-bold transition-all",
                type === 'expense' ? "bg-background shadow-lg text-pink-500" : "text-muted-foreground"
              )}
            >
              Xarajat
            </button>
            <button 
              type="button"
              onClick={() => { setType('income'); setCategory(INCOME_CATEGORIES[0]); }}
              className={cn(
                "flex-1 py-3 rounded-xl font-bold transition-all",
                type === 'income' ? "bg-background shadow-lg text-emerald-500" : "text-muted-foreground"
              )}
            >
              Daromad
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Miqdor</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl px-4 py-4 text-2xl font-black focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Kategoriya</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all appearance-none"
              >
                {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {category === 'Boshqa' && (
              <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nimaligini ko'rsating</label>
                <input 
                  type="text" 
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  placeholder="Masalan: Obuna, Sovg'a"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Sana</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Eslatma (Ixtiyoriy)</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                placeholder="Bu nima uchun edi?"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 rpg-gradient rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Qo\'shilmoqda...' : 'Tranzaksiya qo\'shish'}
          </button>
        </form>
      </div>
    </div>
  );
}

function NotificationsPage({ notifications, setNotifications }: { notifications: Notification[], setNotifications: React.Dispatch<React.SetStateAction<Notification[]>> }) {
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">Xabarlar</h2>
          <p className="text-muted-foreground text-sm">Tizim xabarlari va eslatmalar.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={markAllAsRead} 
            className="text-[10px] font-black uppercase tracking-widest text-cyan-500 hover:text-cyan-400 transition-colors"
          >
            Hammasini o'qish
          </button>
          <button 
            onClick={clearAll} 
            className="text-[10px] font-black uppercase tracking-widest text-pink-500 hover:text-pink-400 transition-colors"
          >
            Tozalash
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div key={n.id} className={cn(
              "rpg-card p-5 rounded-3xl border-l-4 transition-all",
              n.read ? "border-l-border opacity-60" : "border-l-cyan-500 shadow-lg shadow-cyan-500/10"
            )}>
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-sm">{n.title}</h4>
                <span className="text-[10px] text-muted-foreground">{format(n.date, 'HH:mm')}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-muted-foreground opacity-20" />
            </div>
            <p className="text-muted-foreground italic text-sm">Yangi xabarlar yo'q.</p>
          </div>
        )}
      </div>
    </div>
  );
}
