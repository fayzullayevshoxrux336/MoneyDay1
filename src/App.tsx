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
  deleteDoc,
  increment,
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
  Trash2,
  Camera,
  Coins,
  Activity,
  Settings,
  Trophy,
  Target,
  UserCheck,
  ChevronDown,
  ShieldCheck,
  ShoppingBag,
  Package,
  HelpCircle,
  BookOpen
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
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { uz } from 'date-fns/locale';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import * as XLSX from 'xlsx';

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
  savingsGoal?: string;
  savingsGoalAmount?: number;
  wishlist?: { id: string; name: string; price: number; icon: string }[];
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

interface GlossaryTerm {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

// --- Constants ---
const EXPENSE_CATEGORIES = ['Ovqat', 'Transport', 'Internet', 'O\'yinlar', 'Boshqa'];
const INCOME_CATEGORIES = ['Oylik', 'Sovg\'a', 'Bonus', 'Boshqa'];
const COLORS = ['#00FFFF', '#FF00FF', '#00FF00', '#FFFF00', '#FF8042'];

const GLOSSARY: Record<string, GlossaryTerm> = {
  balance: {
    id: 'balance',
    title: 'Balans',
    description: 'Sizning jami mavjud mablag\'ingiz. Bu sizning RPG olamidagi "Oltinlaringiz" hisoblanadi. Kirim va chiqimlar asosida o\'zgarib turadi.',
    icon: <Wallet className="w-6 h-6 text-cyan-500" />
  },
  hp: {
    id: 'hp',
    title: 'Byudjet HP',
    description: 'Sizning moliyaviy sog\'lig\'ingiz. Agar oylik xarajatlaringiz belgilangan byudjetdan oshsa, HP kamayadi. HP 0 bo\'lsa, siz "bankrot" holatiga yaqinlashasiz.',
    icon: <Activity className="w-6 h-6 text-pink-500" />
  },
  xp: {
    id: 'xp',
    title: 'XP va Daraja',
    description: 'Tranzaksiyalarni qayd etish, maqsadlarga erishish va streaklarni saqlash orqali tajriba (XP) to\'playsiz. XP yetarli bo\'lganda darajangiz (Level) oshadi.',
    icon: <Sparkles className="w-6 h-6 text-yellow-500" />
  },
  streak: {
    id: 'streak',
    title: 'Kunlik Streak',
    description: 'Ketma-ket necha kun davomida ilovadan foydalanib, moliyaingizni nazorat qilayotganingizni ko\'rsatadi. Streak qancha uzoq bo\'lsa, intizomingiz shuncha yuqori.',
    icon: <Zap className="w-6 h-6 text-orange-500" />
  },
  safety: {
    id: 'safety',
    title: 'Xavfsizlik Skori',
    description: 'AI tomonidan hisoblangan ko\'rsatkich. Hozirgi sarflash tezligingiz bilan oy oxirigacha pulingiz yetish ehtimolini foizda ko\'rsatadi.',
    icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />
  },
  goal: {
    id: 'goal',
    title: 'Sarmoya Maqsadi',
    description: "Siz erishmoqchi bo'lgan moliyaviy cho'qqi. Maqsad sari har bir qadamingiz foizlarda aks etadi.",
    icon: <Target className="w-6 h-6 text-cyan-500" />
  }
};

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
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showGlossary, setShowGlossary] = useState<string | null>(null);

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

  // Level Up Logic
  useEffect(() => {
    if (!profile || !user) return;
    const level = profile.level || 1;
    const xp = profile.xp || 0;
    const nextLevelXp = level * 1000;
    
    if (xp >= nextLevelXp) {
      updateDoc(doc(db, 'users', user.uid), {
        level: level + 1,
        xp: xp - nextLevelXp
      });
      
      // Notify user
      const newNotif: Notification = {
        id: 'levelup-' + new Date().getTime(),
        title: 'LEVEL UP! 🎊',
        message: `Tabriklaymiz! Siz ${level + 1}-darajaga ko'tarildingiz! Sarguzashtingiz davom etmoqda.`,
        date: new Date(),
        read: false
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  }, [profile, user]);

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
          <header 
            className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between shrink-0"
            style={{ paddingTop: 'calc(1rem + var(--sat, 0px))' }}
          >
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rpg-gradient rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Wallet className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">MoneyDay</h1>
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

          <main 
            className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar"
            style={{ paddingBottom: 'calc(8rem + var(--sab, 0px))' }}
          >
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
              onEditTransaction={setEditingTransaction}
              onUpdateWishlist={(wishlist) => {
                if (user) {
                  updateDoc(doc(db, 'users', user.uid), { wishlist });
                }
              }}
              setShowGlossary={setShowGlossary}
            />
          )}
          {activeTab === 'stats' && <Statistics transactions={transactions} profile={profile} />}
          {activeTab === 'notifications' && (
            <NotificationsPage 
              notifications={notifications} 
              setNotifications={setNotifications} 
            />
          )}
          {activeTab === 'profile' && (
            <ProfilePage 
              profile={profile} 
              user={user} 
              transactions={transactions} 
              setNotifications={setNotifications}
              setShowGlossary={setShowGlossary}
            />
          )}
        </main>

          {/* Navigation */}
          <nav 
            className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border p-4 flex justify-around items-center z-50"
            style={{ paddingBottom: 'calc(1rem + var(--sab, 0px))' }}
          >
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

          {/* Glossary Modal */}
          {showGlossary && GLOSSARY[showGlossary] && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="rpg-card w-full max-w-xs p-6 rounded-3xl border-cyan-500/30 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
                    {GLOSSARY[showGlossary].icon}
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold tracking-tight">{GLOSSARY[showGlossary].title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {GLOSSARY[showGlossary].description}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowGlossary(null)}
                    className="w-full py-3 bg-cyan-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-cyan-500/20 hover:bg-cyan-600 transition-colors"
                  >
                    Tushunarli
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add/Edit Transaction Modal */}
          {(showAddModal || editingTransaction) && (
            <TransactionModal 
              onClose={() => {
                setShowAddModal(false);
                setEditingTransaction(null);
              }} 
              uid={user.uid}
              editData={editingTransaction}
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
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center border border-background">
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
      <div 
        className="w-full max-w-md bg-black text-foreground h-full relative shadow-2xl shadow-black/50 flex flex-col items-center justify-center p-6 overflow-hidden"
        style={{ paddingTop: 'var(--sat, 0px)', paddingBottom: 'var(--sab, 0px)' }}
      >
        {/* Background Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/20 blur-[120px] rounded-full"></div>

        <div className="w-full z-10">
          <div className="text-center mb-10">
            <div className="w-20 h-20 rpg-gradient rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-purple-500/40 mb-4 animate-bounce">
              <Wallet className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">MoneyDay</h1>
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
            className="w-full py-4 rpg-gradient rounded-2xl text-white font-bold uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
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
  setFilterMonth,
  onEditTransaction,
  onUpdateWishlist,
  setShowGlossary
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
  setFilterMonth: (m: string) => void,
  onEditTransaction: (tx: Transaction) => void,
  onUpdateWishlist: (wishlist: any[]) => void,
  setShowGlossary: (term: string | null) => void
}) {
  const [showShopModal, setShowShopModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemIcon, setNewItemIcon] = useState('📦');

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
  
  // Budget HP Bar
  const budgetHP = profile?.monthlyBudget ? Math.max(0, Math.round(((profile.monthlyBudget - monthExpense) / profile.monthlyBudget) * 100)) : 100;
  
  // Savings Goal Progress
  const savingsGoalProgress = profile?.savingsGoalAmount ? Math.min(100, Math.max(0, Math.round((balance / profile.savingsGoalAmount) * 100))) : 0;

  // Financial Forecast Logic
  const getForecast = () => {
    const now = new Date();
    const daysInMonth = endOfMonth(now).getDate();
    const daysPassed = now.getDate();
    const daysRemaining = daysInMonth - daysPassed;
    
    const dailyAvg = monthExpense / daysPassed;
    const projectedExpense = dailyAvg * daysInMonth;
    
    const monthlyIncome = transactions
      .filter(tx => {
        const d = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && tx.type === 'income';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
      
    const projectedSavings = monthlyIncome - projectedExpense;
    const safetyScore = profile?.monthlyBudget 
      ? Math.max(0, Math.min(100, Math.round(((profile.monthlyBudget - projectedExpense) / profile.monthlyBudget) * 100 + 50)))
      : 50;

    return { projectedExpense, projectedSavings, safetyScore, daysRemaining };
  };
  const forecast = getForecast();

  // Daily Savings for Wishlist
  const calculateDailySavings = () => {
    const now = new Date();
    const daysPassed = now.getDate();
    const monthlyIncome = transactions
      .filter(tx => {
        const d = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && tx.type === 'income';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const monthlyExpense = transactions
      .filter(tx => {
        const d = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && tx.type === 'expense';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);

    const dailySavings = Math.max(0, (monthlyIncome - monthlyExpense) / daysPassed);
    return dailySavings || 1; // Avoid division by zero
  };
  const dailySavings = calculateDailySavings();

  // Streak Logic
  const calculateStreak = () => {
    if (transactions.length === 0) return 0;
    let streakCount = 0;
    let checkDate = new Date();
    
    const sortedTxs = [...transactions].sort((a, b) => {
      const da = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
      const db = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
      return db.getTime() - da.getTime();
    });

    const hasToday = sortedTxs.some(tx => isSameDay(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), checkDate));
    if (!hasToday) {
      checkDate = subDays(checkDate, 1);
      const hasYesterday = sortedTxs.some(tx => isSameDay(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), checkDate));
      if (!hasYesterday) return 0;
    }

    while (true) {
      const hasTx = sortedTxs.some(tx => isSameDay(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), checkDate));
      if (hasTx) {
        streakCount++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
    return streakCount;
  };
  const streak = calculateStreak();

  // Daily Quests Logic
  const quests = [
    { 
      id: 1, 
      title: 'Birinchi qadam', 
      desc: 'Bugun kamida bitta tranzaksiya yozing', 
      done: todayTxs.length > 0,
      icon: <Zap className="w-4 h-4" />,
      color: 'text-yellow-400'
    },
    { 
      id: 2, 
      title: 'Tejamkorlik', 
      desc: 'Bugun xarajat 100,000 dan oshmasin', 
      done: todayExpense < 100000 && todayExpense > 0,
      icon: <Shield className="w-4 h-4" />,
      color: 'text-cyan-400'
    },
    { 
      id: 3, 
      title: 'Oltin yig\'uvchi', 
      desc: 'Bugun daromad qo\'shing', 
      done: todayIncome > 0,
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-emerald-400'
    },
  ];

  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const nextLevelXp = level * 1000;
  const xpProgress = (xp / nextLevelXp) * 100;

  const getWealthRank = (bal: number) => {
    if (bal < 1000000) return { name: 'Qashshoq Sarguzashtchi', color: 'text-gray-400' };
    if (bal < 5000000) return { name: 'Oltin Izlovchi', color: 'text-yellow-400' };
    if (bal < 20000000) return { name: 'Boy Savdogar', color: 'text-cyan-400' };
    return { name: 'Afsonaviy Sulton', color: 'text-purple-400' };
  };
  const rank = getWealthRank(balance);

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Salom, {profile?.name}!</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-muted-foreground text-xs sm:text-sm">Sarguzasht davom etmoqda.</p>
            <button 
              onClick={() => setShowGlossary('streak')}
              className="flex items-center gap-1.5 bg-orange-500/20 px-2.5 py-1 rounded-full border border-orange-500/30 whitespace-nowrap shadow-[0_0_10px_rgba(249,115,22,0.1)] hover:scale-105 transition-transform"
            >
              <Zap className="w-3 h-3 text-orange-400 animate-pulse" />
              <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">{streak} KUNLIK STREAK</span>
            </button>
          </div>
        </div>
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg border-2 border-background overflow-hidden",
          !profile?.photoURL && (profile?.avatarColor?.startsWith('from-') ? `bg-gradient-to-br ${profile.avatarColor}` : (profile?.avatarColor || 'bg-cyan-500'))
        )}>
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            profile?.name?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="rpg-gradient p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Balans</p>
                <button onClick={() => setShowGlossary('balance')} className="opacity-40 hover:opacity-100 transition-opacity">
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight truncate">{formatCurrency(balance, profile?.currency)}</h3>
              <div className="mt-2">
                <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20 border border-white/10 inline-block", rank.color)}>
                  {rank.name}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2">
              <button 
                onClick={() => setShowGlossary('xp')}
                className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg border border-white/10 hover:bg-white/20 transition-colors"
              >
                <Award className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] font-bold">LVL {level}</span>
              </button>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all duration-1000" 
                  style={{ width: `${xpProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
              <p className="text-[8px] font-bold uppercase tracking-widest opacity-70 mb-1">Kirim</p>
              <p className="text-sm font-bold">{formatCurrency(todayIncome, profile?.currency)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
              <p className="text-[8px] font-bold uppercase tracking-widest opacity-70 mb-1">Chiqim</p>
              <p className="text-sm font-bold">{formatCurrency(todayExpense, profile?.currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Adventure Status (HP & Goals) */}
      <div className="space-y-4">
        {/* Budget HP Bar */}
        <div className="rpg-card p-4 rounded-2xl border-pink-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-pink-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">HP</span>
              <button onClick={() => setShowGlossary('hp')} className="opacity-40 hover:opacity-100 transition-opacity">
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>
            <span className={cn("text-[10px] font-bold", budgetHP < 20 ? "text-red-500" : "text-pink-500")}>
              {budgetHP}%
            </span>
          </div>
          <div className="h-2 bg-accent rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000",
                budgetHP > 50 ? "bg-emerald-500" : budgetHP > 20 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${budgetHP}%` }}
            ></div>
          </div>
        </div>

        {/* Savings Goal */}
        {profile?.savingsGoal && (
          <div className="rpg-card p-4 rounded-2xl border-cyan-500/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-3 h-3 text-cyan-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate max-w-[120px]">{profile.savingsGoal}</span>
                <button onClick={() => setShowGlossary('goal')} className="opacity-40 hover:opacity-100 transition-opacity">
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <span className="text-[10px] font-bold text-cyan-500">{savingsGoalProgress}%</span>
            </div>
            <div className="h-2 bg-accent rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-500 transition-all duration-1000"
                style={{ width: `${savingsGoalProgress}%` }}
              ></div>
            </div>
          </div>
        )}
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

      {/* Financial Forecast (New Useful Feature) */}
      <div className="rpg-card p-6 rounded-3xl border-blue-500/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Sparkles className="w-12 h-12 text-blue-500" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Moliyaviy Bashorat</h4>
                <p className="text-[8px] text-blue-500 font-bold uppercase tracking-tight">Oy oxirigacha kutilayotgan holat</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button 
                onClick={() => setShowGlossary('safety')}
                className={cn(
                  "text-[9px] font-bold px-2 py-1 rounded-full border whitespace-nowrap hover:scale-105 transition-transform",
                  forecast.safetyScore > 70 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                  forecast.safetyScore > 40 ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                  "bg-red-500/10 border-red-500/20 text-red-500"
                )}
              >
                XAVFSIZLIK: {forecast.safetyScore}%
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Kutilayotgan xarajat</p>
              <p className="text-sm font-bold text-blue-400">{formatCurrency(forecast.projectedExpense, profile?.currency)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Kutilayotgan jamg'arma</p>
              <p className={cn("text-sm font-bold", forecast.projectedSavings >= 0 ? "text-emerald-400" : "text-red-400")}>
                {formatCurrency(forecast.projectedSavings, profile?.currency)}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              {forecast.safetyScore > 70 
                ? "Siz juda tejamkorsiz! Oy oxirigacha byudjetingiz bemalol yetadi." 
                : forecast.safetyScore > 40 
                ? "Holat barqaror, lekin kutilmagan xarajatlardan ehtiyot bo'ling." 
                : "Diqqat! Hozirgi sarflash tezligingiz bilan byudjetingiz oy oxirigacha yetmasligi mumkin."}
            </p>
          </div>
        </div>
      </div>

      {/* Achievements Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Yutuqlar</h4>
          <button onClick={() => {/* Navigate to profile achievements */}} className="text-[10px] font-bold text-cyan-500 hover:underline">Hammasi</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
          {[
            { name: 'Tejamkor', icon: '🛡️', unlocked: budgetHP > 50, desc: 'Byudjet 50% dan yuqori' },
            { name: 'Boyvachcha', icon: '💰', unlocked: balance > 1000000, desc: '1 mln balans' },
            { name: 'Intizomli', icon: '📜', unlocked: streak >= 3, desc: '3 kunlik streak' },
            { name: 'Sarmoyador', icon: '💎', unlocked: savingsGoalProgress > 50, desc: 'Maqsad 50% bajarildi' },
          ].map((ach, i) => (
            <div 
              key={i}
              className={cn(
                "flex-shrink-0 w-36 p-4 rounded-2xl border transition-all",
                ach.unlocked 
                  ? "bg-emerald-500/5 border-emerald-500/20 opacity-100 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
                  : "bg-accent/50 border-border opacity-40 grayscale"
              )}
            >
              <div className="text-2xl mb-2">{ach.icon}</div>
              <p className="text-[10px] font-bold uppercase tracking-tight truncate">{ach.name}</p>
              <p className="text-[8px] text-muted-foreground leading-tight mt-1 line-clamp-2">{ach.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Book (Glossary) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Bilimlar Kitobi</h4>
          <BookOpen className="w-3 h-3 text-muted-foreground opacity-50" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(GLOSSARY).slice(0, 4).map((term) => (
            <button 
              key={term.id}
              onClick={() => setShowGlossary(term.id)}
              className="rpg-card p-3 rounded-2xl border-white/5 hover:border-cyan-500/30 transition-all flex items-center gap-3 text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 group-hover:scale-110 transition-transform [&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-cyan-500">
                {term.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-tight truncate">{term.title}</p>
                <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Tarif</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Equipment Shop (Wishlist) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-3 h-3 text-purple-500" />
            <h4 className="font-bold uppercase tracking-widest text-[9px] text-muted-foreground">Anjomlar Do'koni</h4>
          </div>
          <button 
            onClick={() => setShowShopModal(true)}
            className="flex items-center gap-1 text-[9px] font-bold text-purple-500 hover:text-purple-400"
          >
            <PlusCircle className="w-2.5 h-2.5" />
            QO'SHISH
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {profile?.wishlist && profile.wishlist.length > 0 ? (
            profile.wishlist.map((item) => {
              const remaining = Math.max(0, item.price - balance);
              const daysToReach = Math.ceil(remaining / dailySavings);
              const progress = Math.min(100, Math.round((balance / item.price) * 100));
              
              return (
                <div key={item.id} className="rpg-card p-3 rounded-xl border-purple-500/10 relative group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-xl">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest truncate">{item.name}</h5>
                        <button 
                          onClick={() => {
                            const newWishlist = profile.wishlist?.filter(w => w.id !== item.id) || [];
                            onUpdateWishlist(newWishlist);
                          }}
                          className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs font-bold text-purple-400">{formatCurrency(item.price, profile.currency)}</p>
                        <p className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground">
                          {remaining > 0 ? `${daysToReach} kun` : "Tayyor!"}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1 bg-accent rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            progress === 100 ? "bg-emerald-500" : "bg-purple-500"
                          )}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rpg-card p-6 rounded-xl border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-1">
              <Package className="w-6 h-6 text-muted-foreground/30" />
              <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">Hali anjomlar yo'q</p>
            </div>
          )}
        </div>
      </div>

      {/* Shop Modal */}
      {showShopModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="rpg-card p-6 rounded-3xl border-purple-500/30 max-w-sm w-full space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-widest">Yangi Anjom</h4>
              <button onClick={() => setShowShopModal(false)} className="text-muted-foreground hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Anjom nomi</label>
                <input 
                  type="text" 
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-all text-sm"
                  placeholder="Masalan: iPhone 15"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Narxi</label>
                <input 
                  type="number" 
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-all text-sm"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ikonka</label>
                <div className="grid grid-cols-5 gap-2">
                  {['📦', '📱', '💻', '🚗', '🏠', '🍕', '🎮', '👟', '⌚', '🚲'].map(icon => (
                    <button 
                      key={icon}
                      onClick={() => setNewItemIcon(icon)}
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all",
                        newItemIcon === icon ? "bg-purple-500 text-white scale-110" : "bg-white/5 hover:bg-white/10"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (!newItemName || !newItemPrice) return;
                const newItem = {
                  id: Date.now().toString(),
                  name: newItemName,
                  price: Number(newItemPrice),
                  icon: newItemIcon
                };
                const newWishlist = [...(profile?.wishlist || []), newItem];
                onUpdateWishlist(newWishlist);
                setShowShopModal(false);
                setNewItemName('');
                setNewItemPrice('');
              }}
              className="w-full py-4 rpg-gradient rounded-2xl text-white font-bold uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              DO'KONGA QO'SHISH
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-3">
        <h4 className="font-bold uppercase tracking-widest text-[9px] text-muted-foreground px-1">Tezkor amallar</h4>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { label: 'Tushlik', cat: 'Ovqat', amount: 30000, icon: '🍔' },
            { label: 'Yo\'l kira', cat: 'Transport', amount: 2000, icon: '🚌' },
            { label: 'Kofe', cat: 'O\'yin-kulgi', amount: 15000, icon: '☕' },
            { label: 'Bozor', cat: 'Xaridlar', amount: 100000, icon: '🛒' },
          ].map((action, i) => (
            <button
              key={i}
              onClick={async () => {
                try {
                  await addDoc(collection(db, 'transactions'), {
                    uid: profile?.uid,
                    type: 'expense',
                    amount: action.amount,
                    category: action.cat,
                    date: serverTimestamp(),
                    note: action.label,
                    createdAt: serverTimestamp()
                  });
                  if (profile) {
                    await updateDoc(doc(db, 'users', profile.uid), {
                      xp: (profile.xp || 0) + 20
                    });
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              className="flex-shrink-0 rpg-card p-3 rounded-xl flex flex-col items-center gap-1 min-w-[75px] active:scale-95 transition-transform"
            >
              <span className="text-lg">{action.icon}</span>
              <span className="text-[8px] font-bold uppercase tracking-widest truncate w-full text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Quests */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="font-bold uppercase tracking-widest text-[9px] text-muted-foreground">Topshiriqlar</h4>
          <span className="text-[9px] font-bold text-yellow-500">{quests.filter(q => q.done).length}/{quests.length}</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {quests.map(quest => (
            <div key={quest.id} className={cn(
              "rpg-card p-3 rounded-xl flex items-center gap-3 border transition-all",
              quest.done ? "border-emerald-500/20 bg-emerald-500/5 opacity-70" : "border-white/5"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                quest.done ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-muted-foreground"
              )}>
                {quest.done ? <ShieldCheck className="w-4 h-4" /> : quest.icon}
              </div>
              <div className="flex-1">
                <h5 className={cn("text-[10px] font-bold uppercase tracking-widest", quest.done ? "text-emerald-500" : "text-foreground")}>
                  {quest.title}
                </h5>
                <p className="text-[8px] text-muted-foreground">{quest.desc}</p>
              </div>
              {quest.done && (
                <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  <Sparkles className="w-2 h-2 text-emerald-500" />
                  <span className="text-[7px] font-bold text-emerald-500">+50 XP</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
                  className="w-full bg-transparent text-[10px] font-bold uppercase tracking-tighter focus:outline-none cursor-pointer appearance-none"
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
                  className="w-full bg-transparent text-[10px] font-bold uppercase tracking-tighter focus:outline-none cursor-pointer appearance-none"
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
                <div 
                  key={tx.id} 
                  onClick={() => onEditTransaction(tx)}
                  className="rpg-card p-4 rounded-2xl flex items-center justify-between hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-white/5 hover:border-white/10"
                >
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
                      "font-bold text-base",
                      tx.type === 'income' ? "text-emerald-500" : "text-pink-500"
                    )}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, profile?.currency)}
                    </p>
                    {tx.note && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{tx.note}</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 rpg-card rounded-3xl border border-dashed border-border/50">
                <p className="text-sm text-muted-foreground">Ushbu vaqt oralig'ida ma'lumot topilmadi.</p>
              </div>
            )}

            {hasMore && searchQuery === '' && filterYear === 'Hammasi' && filterMonth === 'Hammasi' && (
              <button 
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-5 bg-gradient-to-b from-accent/20 to-accent/5 border border-cyan-500/30 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-500 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all active:scale-95 disabled:opacity-50"
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
        
        Rules:
        1. Use a cool, RPG-like tone (e.g., "Level up your savings", "Avoid the gold sink").
        2. Use Markdown: Use **bold** for key actions and bullet points for the tips.
        3. Keep it very concise (max 2-3 sentences per tip).
        4. Response must be in Uzbek.`,
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
        <h4 className="font-bold text-sm uppercase tracking-widest">AI Moliyaviy Bashorat</h4>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-4 animate-pulse">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
            <Sparkles className="absolute inset-0 m-auto w-5 h-5 text-cyan-500 animate-bounce" />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500">Bashorat qilinmoqda</p>
            <p className="text-[8px] text-muted-foreground uppercase tracking-widest">Oracle bilan bog'lanilmoqda...</p>
          </div>
        </div>
      ) : advice ? (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <div className="relative p-4 rounded-2xl bg-black/40 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <div className="absolute -top-2 -left-2">
              <div className="w-6 h-6 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/50">
                <Zap className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="text-sm text-foreground/90 leading-relaxed prose prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-strong:text-cyan-400 prose-strong:font-bold max-w-none">
              <ReactMarkdown>{advice}</ReactMarkdown>
            </div>
          </div>
          <button 
            onClick={() => setAdvice(null)}
            className="mt-4 w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-cyan-500 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-3 h-3" />
            Maslahatni yopish
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground flex-1">Moliyaviy strategiya kerakmi?</p>
          <button 
            onClick={getAdvice}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 rpg-gradient rounded-xl text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" />
            Oracle bilan bog'lanish
          </button>
        </div>
      )}
    </div>
  );
}

function Statistics({ transactions, profile }: { transactions: Transaction[], profile: UserProfile | null }) {
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const today = new Date();
  
  // Helper to get date from transaction
  const getTxDate = (tx: Transaction) => tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);

  // Filter transactions by timeframe
  const filteredTxs = transactions.filter(tx => {
    const txDate = getTxDate(tx);
    if (timeframe === 'daily') return isSameDay(txDate, today);
    if (timeframe === 'weekly') return txDate >= subDays(today, 7);
    if (timeframe === 'monthly') return txDate >= subDays(today, 30);
    if (timeframe === 'yearly') return txDate >= subDays(today, 365);
    return true;
  });

  const income = filteredTxs.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expense = filteredTxs.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const savings = income - expense;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  
  // Daily Stats (Today hourly)
  const todayHours = Array.from({ length: 24 }, (_, i) => {
    const hourTxs = transactions.filter(tx => {
      const txDate = getTxDate(tx);
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
      const txDate = getTxDate(tx);
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

  // Monthly Stats (Last 30 days trend)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(today, 29 - i);
    const dayTxs = transactions.filter(tx => {
      const txDate = getTxDate(tx);
      return isSameDay(txDate, d) && tx.type === 'expense';
    });
    return {
      name: format(d, 'dd'),
      amount: dayTxs.reduce((sum, tx) => sum + tx.amount, 0)
    };
  });

  // Yearly Stats (Last 12 months)
  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const d = subDays(today, (11 - i) * 30);
    const monthTxs = transactions.filter(tx => {
      const txDate = getTxDate(tx);
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

  const chartData = timeframe === 'daily' ? todayHours : timeframe === 'weekly' ? last7Days : timeframe === 'monthly' ? last30Days : last12Months;

  // Category Stats
  const categoryData = EXPENSE_CATEGORIES.map(cat => {
    const value = filteredTxs
      .filter(tx => tx.type === 'expense' && tx.category === cat)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { name: cat, value };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  // Top 3 Largest Expenses
  const topExpenses = filteredTxs
    .filter(tx => tx.type === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Statistika</h2>
            <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold opacity-70">Moliyaviy sarguzashtingiz tahlili</p>
          </div>
          <div className="p-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 flex gap-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tf => (
              <button 
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  timeframe === tf 
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf === 'daily' ? 'Bugun' : tf === 'weekly' ? 'Hafta' : tf === 'monthly' ? 'Oy' : 'Yil'}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Bento Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Daromad', value: income, color: 'text-emerald-400', icon: TrendingUp, bg: 'from-emerald-500/10' },
            { label: 'Xarajat', value: expense, color: 'text-rose-400', icon: TrendingDown, bg: 'from-rose-500/10' },
            { label: 'Jamg\'arma', value: savings, color: 'text-cyan-400', icon: Wallet, bg: 'from-cyan-500/10' },
            { label: 'Tejamkorlik', value: `${savingsRate}%`, color: 'text-amber-400', icon: PieChartIcon, bg: 'from-amber-500/10' },
          ].map((stat, i) => (
            <div key={i} className={cn(
              "rpg-card p-4 rounded-2xl bg-gradient-to-br to-transparent border-white/5 relative overflow-hidden group",
              stat.bg
            )}>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={cn("w-3 h-3", stat.color)} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</span>
                </div>
                <div className={cn("text-lg font-bold tracking-tight", stat.color)}>
                  {typeof stat.value === 'number' ? formatCurrency(stat.value, profile?.currency) : stat.value}
                </div>
              </div>
              <stat.icon className={cn("absolute -right-2 -bottom-2 w-16 h-16 opacity-5 group-hover:opacity-10 transition-opacity", stat.color)} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 rpg-card p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <TrendingUp className="w-32 h-32 text-cyan-500" />
          </div>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Xarajatlar dinamikasi
              </h4>
              <p className="text-[10px] text-muted-foreground opacity-50">Vaqt davomidagi o'zgarishlar</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(0,255,255,0.5)]"></div>
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">Xarajat</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FFFF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00FFFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '900' }} 
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#00FFFF', fontWeight: '900', fontSize: '12px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginBottom: '4px', fontWeight: 'bold' }}
                  formatter={(value: number) => [formatCurrency(value, profile?.currency), 'Mablag\'']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#00FFFF" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorAmount)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="rpg-card p-6 rounded-3xl flex flex-col">
          <h4 className="font-bold text-xs uppercase tracking-widest mb-8 text-muted-foreground">Kategoriyalar</h4>
          <div className="flex-1 flex flex-col justify-center">
            <div className="h-[220px] w-full relative min-h-[220px]">
              {categoryData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.8)', 
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '16px' 
                        }}
                        formatter={(value: number) => formatCurrency(value, profile?.currency)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jami</span>
                    <span className="text-lg font-bold">{formatCurrency(expense, profile?.currency)}</span>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <PieChartIcon className="w-12 h-12 text-muted-foreground/20 mb-2" />
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Ma'lumot yo'q</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {categoryData.map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-foreground">{formatCurrency(cat.value, profile?.currency)}</span>
                    <span className="text-[9px] font-bold text-muted-foreground opacity-50">{Math.round((cat.value / expense) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Expenses & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rpg-card p-6 rounded-3xl">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Eng katta xarajatlar</h4>
            <ShieldCheck className="w-4 h-4 text-cyan-500 opacity-50" />
          </div>
          <div className="space-y-4">
            {topExpenses.length > 0 ? (
              topExpenses.map((tx, i) => (
                <div key={tx.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-lg font-bold text-cyan-500 border border-white/5 group-hover:scale-110 transition-transform">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">
                      {tx.note || tx.category}
                    </p>
                    <p className="text-[9px] font-bold text-muted-foreground opacity-50">
                      {format(getTxDate(tx), 'dd MMMM, yyyy', { locale: uz })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-rose-400">-{formatCurrency(tx.amount, profile?.currency)}</p>
                    <div className="flex items-center justify-end gap-1">
                      <div className="w-1 h-1 rounded-full bg-rose-500"></div>
                      <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">Xarajat</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-muted-foreground text-xs font-bold uppercase tracking-widest">Xarajatlar mavjud emas</p>
            )}
          </div>
        </div>

        <div className="rpg-card p-6 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-transparent flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 opacity-5">
            <Zap className="w-48 h-48 text-cyan-500" />
          </div>
          <div className="relative z-10">
            <h4 className="font-bold text-xs uppercase tracking-widest text-muted-foreground mb-6">Kunlik o'rtacha tahlil</h4>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">O'rtacha kunlik xarajat</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold tracking-tighter text-cyan-500">
                    {formatCurrency(Math.round(expense / (timeframe === 'daily' ? 1 : timeframe === 'weekly' ? 7 : timeframe === 'monthly' ? 30 : 365)), profile?.currency)}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 opacity-50">/ kun</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Tranzaksiyalar</p>
                  <p className="text-xl font-bold">{filteredTxs.length}</p>
                </div>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Eng faol kun</p>
                  <p className="text-xl font-bold">
                    {chartData.length > 0 ? chartData.reduce((prev, current) => (prev.amount > current.amount) ? prev : current).name : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 relative z-10">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Zap className="w-4 h-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-1">Maslahat</p>
                <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                  {savingsRate > 20 
                    ? "Ajoyib! Sizning jamg'arma darajangiz yuqori. Investitsiya haqida o'ylab ko'ring." 
                    : "Xarajatlarni biroz kamaytirish orqali jamg'armani 20% ga yetkazishga harakat qiling."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePage({ 
  profile, 
  user, 
  transactions, 
  setNotifications,
  setShowGlossary
}: { 
  profile: UserProfile | null, 
  user: FirebaseUser, 
  transactions: Transaction[], 
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>,
  setShowGlossary: (term: string | null) => void
}) {
  const [name, setName] = useState(profile?.name || '');
  const [budget, setBudget] = useState(profile?.monthlyBudget || 1000000);
  const [currency, setCurrency] = useState(profile?.currency || 'UZS');
  const [language, setLanguage] = useState(profile?.language || 'uz');
  const [birthday, setBirthday] = useState(profile?.birthday || '');
  const [theme, setTheme] = useState(profile?.theme || 'Cyberpunk');
  const [avatarColor, setAvatarColor] = useState(profile?.avatarColor || 'bg-cyan-500');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [savingsGoal, setSavingsGoal] = useState(profile?.savingsGoal || '');
  const [savingsGoalAmount, setSavingsGoalAmount] = useState(profile?.savingsGoalAmount || 0);
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
  const fields = [name, budget, currency, language, birthday, theme, photoURL, savingsGoal, savingsGoalAmount];
  const completeness = Math.round((fields.filter(f => !!f).length / fields.length) * 100);

  // Financial Skills Calculation
  const calculateStreak = () => {
    if (transactions.length === 0) return 0;
    let streakCount = 0;
    let checkDate = new Date();
    const sortedTxs = [...transactions].sort((a, b) => {
      const da = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
      const db = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
      return db.getTime() - da.getTime();
    });
    const hasToday = sortedTxs.some(tx => isSameDay(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), checkDate));
    if (!hasToday) {
      checkDate = subDays(checkDate, 1);
      const hasYesterday = sortedTxs.some(tx => isSameDay(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), checkDate));
      if (!hasYesterday) return 0;
    }
    while (true) {
      const hasTx = sortedTxs.some(tx => isSameDay(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), checkDate));
      if (hasTx) {
        streakCount++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
    return streakCount;
  };

  const streak = calculateStreak();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthExpense = transactions
    .filter(tx => {
      const d = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && tx.type === 'expense';
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const savingSkill = Math.min(100, totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0);
  const disciplineSkill = Math.min(100, Math.round((streak / 30) * 100));
  const strategySkill = profile?.monthlyBudget ? Math.min(100, Math.max(0, Math.round((1 - (monthExpense / profile.monthlyBudget)) * 100))) : 0;

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
        photoURL,
        savingsGoal,
        savingsGoalAmount: Number(savingsGoalAmount)
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

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      const newNotification: Notification = {
        id: Date.now().toString(),
        title: 'Xatolik',
        message: 'Rasm hajmi 10MB dan oshmasligi kerak!',
        date: new Date(),
        read: false
      };
      setNotifications(prev => [newNotification, ...prev]);
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
    if (transactions.length === 0) {
      alert('Eksport qilish uchun tranzaksiyalar mavjud emas!');
      return;
    }

    // Prepare data for Excel
    const excelData = transactions.map(t => ({
      'Sana': t.date instanceof Timestamp ? format(t.date.toDate(), 'yyyy-MM-dd HH:mm') : 
              t.date?.toDate ? format(t.date.toDate(), 'yyyy-MM-dd HH:mm') :
              t.date instanceof Date ? format(t.date, 'yyyy-MM-dd HH:mm') : String(t.date),
      'Turi': t.type === 'income' ? 'Daromad' : 'Xarajat',
      'Kategoriya': t.category,
      'Miqdor': t.amount,
      'Valyuta': profile?.currency || 'UZS',
      'Izoh': t.note || ''
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tranzaksiyalar');

    // Generate and download file
    XLSX.writeFile(workbook, `moneyday_hisobot_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const achievements = [
    { id: 1, name: 'Birinchi qadam', icon: <Zap className="w-4 h-4" />, unlocked: transactions.length > 0, desc: 'Birinchi tranzaksiya qo\'shildi' },
    { id: 2, name: 'Byudjet ustasi', icon: <Shield className="w-4 h-4" />, unlocked: level >= 5, desc: '5-darajaga yetdingiz' },
    { id: 3, name: 'Oltin jamg\'arma', icon: <Award className="w-4 h-4" />, unlocked: balance >= 10000000, desc: '10 mln so\'m jamg\'arildi' },
  ];

  const avatarColors = [
    'from-cyan-500 to-blue-600', 
    'from-purple-500 to-indigo-600', 
    'from-pink-500 to-rose-600', 
    'from-emerald-500 to-teal-600', 
    'from-yellow-500 to-orange-600', 
    'from-indigo-500 to-violet-600'
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Profile Header */}
      <div className="relative">
        <div className="h-40 w-full bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-emerald-500/20 rounded-3xl border border-white/5 overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="absolute top-4 right-4 flex gap-2">
            <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
              <Trophy className="w-3 h-3 text-yellow-400" />
              <span className="text-[8px] font-bold uppercase tracking-widest text-white">Rank: {rank.name}</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-12 left-6 flex items-end gap-6">
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
                "w-24 h-24 rounded-3xl flex items-center justify-center text-white text-4xl font-bold shadow-2xl border-4 border-background overflow-hidden transition-all cursor-pointer",
                !photoURL && (avatarColor.startsWith('from-') ? `bg-gradient-to-br ${avatarColor}` : avatarColor)
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
                className="absolute -top-2 -left-2 w-8 h-8 bg-red-500 rounded-xl border border-background flex items-center justify-center shadow-lg hover:scale-110 transition-all opacity-0 group-hover:opacity-100 z-20"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            )}
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-background rounded-2xl border border-border flex items-center justify-center shadow-lg">
              <span className="text-cyan-500 font-bold text-sm">Lv.{level}</span>
            </div>
          </div>
          <div className="mb-2">
            <h3 className="text-2xl font-bold tracking-tighter">{name}</h3>
            <div className="flex items-center gap-2">
              <Trophy className={cn("w-3 h-3", rank.color)} />
              <p className={cn("text-[10px] font-bold uppercase tracking-widest", rank.color)}>{rank.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* XP Progress & Daily Reward */}
      <div className="rpg-card p-6 rounded-3xl mt-12 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tajriba (XP)</span>
          </div>
          <span className="text-[10px] font-bold text-cyan-500">{xp} / {nextLevelXp} XP</span>
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
          className="w-full py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-500 text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Coins className="w-4 h-4" />
          {claiming ? 'Olinmoqda...' : 'Kunlik mukofot (100 XP)'}
        </button>
      </div>

      {/* Profile Completeness */}
      <div className="rpg-card p-5 rounded-3xl border-emerald-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Profil to'liqligi</span>
          <span className="text-[10px] font-bold text-emerald-500">{completeness}%</span>
        </div>
        <div className="h-1.5 bg-accent rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-1000"
            style={{ width: `${completeness}%` }}
          ></div>
        </div>
      </div>

      {/* Financial Skills (RPG Style) */}
      <div className="rpg-card p-6 rounded-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Moliyaviy Mahoratlar</h4>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-cyan-500 uppercase">Live Stats</span>
          </div>
        </div>
        
        <div className="space-y-5">
          {/* Saving Skill */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-emerald-500" />
                Tejamkorlik
              </span>
              <span className="text-emerald-500">{savingSkill}%</span>
            </div>
            <div className="h-2 bg-accent rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000"
                style={{ width: `${savingSkill}%` }}
              ></div>
            </div>
          </div>

          {/* Discipline Skill */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-500" />
                Intizom
              </span>
              <span className="text-yellow-500">{disciplineSkill}%</span>
            </div>
            <div className="h-2 bg-accent rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all duration-1000"
                style={{ width: `${disciplineSkill}%` }}
              ></div>
            </div>
          </div>

          {/* Strategy Skill */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2">
                <Target className="w-3 h-3 text-purple-500" />
                Strategiya
              </span>
              <span className="text-purple-500">{strategySkill}%</span>
            </div>
            <div className="h-2 bg-accent rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)] transition-all duration-1000"
                style={{ width: `${strategySkill}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rpg-card p-4 rounded-2xl border-emerald-500/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Muvaffaqiyatlar</p>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-bold">{achievements.filter(a => a.unlocked).length} / {achievements.length}</span>
          </div>
        </div>
        <div className="rpg-card p-4 rounded-2xl border-cyan-500/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Tranzaksiyalar</p>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" />
            <span className="text-lg font-bold">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Yutuqlar</h4>
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

      {/* Quest Log (Recent Activity) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sarguzashtlar Tarixi</h4>
          <Activity className="w-4 h-4 text-cyan-500" />
        </div>
        <div className="rpg-card p-4 rounded-3xl space-y-4">
          {transactions.slice(0, 5).map((tx, i) => (
            <div key={tx.id} className="flex items-center gap-4 border-b border-white/5 last:border-0 pb-3 last:pb-0">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs",
                tx.type === 'income' ? "bg-emerald-500/10 text-emerald-500" : "bg-pink-500/10 text-pink-500"
              )}>
                {tx.type === 'income' ? '+' : '-'}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold">{tx.category}</p>
                <p className="text-[10px] text-muted-foreground">{tx.note || 'Izohsiz'}</p>
              </div>
              <div className="text-right">
                <p className={cn("text-xs font-bold", tx.type === 'income' ? "text-emerald-500" : "text-pink-500")}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, profile?.currency)}
                </p>
                <p className="text-[8px] text-muted-foreground uppercase">{format(tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date), 'dd MMM', { locale: uz })}</p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-center py-4 text-xs text-muted-foreground">Hali sarguzashtlar mavjud emas...</p>
          )}
        </div>
      </div>

      {/* Avatar Customization */}
      <div className="rpg-card p-6 rounded-3xl space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Avatar rangi</h4>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 py-4">
          {avatarColors.map(color => (
            <button 
              key={color}
              onClick={() => setAvatarColor(color)}
              className={cn(
                "aspect-square rounded-2xl transition-all relative group min-h-[60px]",
                color.startsWith('from-') ? `bg-gradient-to-br ${color}` : color,
                avatarColor === color 
                  ? "ring-2 ring-white ring-offset-4 ring-offset-background scale-110 shadow-[0_0_25px_rgba(255,255,255,0.3)]" 
                  : "opacity-40 hover:opacity-100 hover:scale-105"
              )}
            >
              {avatarColor === color && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_12px_#fff]"></div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Form */}
      <div className="rpg-card p-6 rounded-3xl space-y-8">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest">Sozlamalar</h4>
              <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Qahramon atributlarini tahrirlash</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section: Personal Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shaxsiy ma'lumotlar</span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ko'rinadigan ism</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all placeholder:text-muted-foreground/30"
                    placeholder="Qahramon nomi"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tug'ilgan kun</label>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
                  <input 
                    type="date" 
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Savings Goal */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Jamg'arma maqsadi</span>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Maqsad nomi</label>
                <div className="relative group">
                  <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                  <input 
                    type="text" 
                    value={savingsGoal}
                    onChange={(e) => setSavingsGoal(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all placeholder:text-muted-foreground/30"
                    placeholder="Masalan: Yangi noutbuk"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Maqsad summasi</label>
                <div className="relative group">
                  <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                  <input 
                    type="number" 
                    value={savingsGoalAmount}
                    onChange={(e) => setSavingsGoalAmount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: App Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ilova sozlamalari</span>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => setShowGlossary('balance')}
                className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <BookOpen className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">Bilimlar Kitobi</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Atamalar tarifi</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-cyan-500 transition-colors" />
              </button>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Oylik byudjet limiti</label>
                <div className="relative group">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
                  <input 
                    type="number" 
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Valyuta</label>
                  <div className="relative">
                    <select 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all appearance-none text-sm font-bold"
                    >
                      <option value="UZS" className="bg-zinc-900">UZS (So'm)</option>
                      <option value="USD" className="bg-zinc-900">USD ($)</option>
                      <option value="EUR" className="bg-zinc-900">EUR (€)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Til</label>
                  <div className="relative">
                    <select 
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all appearance-none text-sm font-bold"
                    >
                      <option value="uz" className="bg-zinc-900">O'zbekcha</option>
                      <option value="en" className="bg-zinc-900">English</option>
                      <option value="ru" className="bg-zinc-900">Русский</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">RPG Mavzusi</label>
                <div className="relative">
                  <select 
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all appearance-none text-sm font-bold"
                  >
                    <option value="Cyberpunk" className="bg-zinc-900">Cyberpunk (Neon)</option>
                    <option value="Fantasy" className="bg-zinc-900">Fantasy (Oltin)</option>
                    <option value="Minimal" className="bg-zinc-900">Minimal (Slate)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 space-y-4 border-t border-white/5">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rpg-gradient rounded-2xl text-white font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Saqlanmoqda...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                O'zgarishlarni saqlash
              </>
            )}
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={exportData}
              className="py-3.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-cyan-500" />
              Eksport
            </button>
            <button 
              onClick={() => alert('Parolni o\'zgartirish... (Tez orada)')}
              className="py-3.5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-purple-500" />
              Xavfsizlik
            </button>
          </div>

          <button 
            onClick={() => signOut(auth)}
            className="w-full py-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/10 hover:border-red-500/40 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Tizimdan chiqish
          </button>
        </div>
      </div>

      {/* Social Links */}
      <div className="rpg-card p-6 rounded-3xl space-y-4 bg-gradient-to-b from-transparent to-cyan-500/5">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hamjamiyat</h4>
          <div className="flex gap-2">
            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse delay-75"></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl hover:bg-cyan-500/10 hover:text-cyan-500 transition-all border border-white/5">
            <Mail className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase">Email</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl hover:bg-purple-500/10 hover:text-purple-500 transition-all border border-white/5">
            <Share2 className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase">Ulashish</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-white/5 rounded-2xl hover:bg-emerald-500/10 hover:text-emerald-500 transition-all border border-white/5">
            <Shield className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase">Yordam</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TransactionModal({ onClose, uid, editData }: { onClose: () => void, uid: string, editData?: Transaction | null }) {
  const [type, setType] = useState<'expense' | 'income'>(editData?.type || 'expense');
  const [amount, setAmount] = useState(editData?.amount?.toString() || '');
  const [category, setCategory] = useState(editData?.category || EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [date, setDate] = useState(editData?.date ? format(editData.date instanceof Timestamp ? editData.date.toDate() : new Date(editData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState(editData?.note || '');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      const data = {
        uid,
        type,
        amount: Number(amount),
        category: category === 'Others' ? customCategory || 'Others' : category,
        date: Timestamp.fromDate(new Date(date)),
        note,
        updatedAt: serverTimestamp()
      };

      if (editData) {
        await updateDoc(doc(db, 'transactions', editData.id), data);
      } else {
        await addDoc(collection(db, 'transactions'), {
          ...data,
          createdAt: serverTimestamp()
        });
        // XP reward for adding transaction
        await updateDoc(doc(db, 'users', uid), {
          xp: increment(20)
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!editData) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'transactions', editData.id));
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in zoom-in-95 duration-200">
          <div className="rpg-card p-8 rounded-3xl border-red-500/50 max-w-xs w-full text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl mx-auto flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-bold">O'chirishni tasdiqlaysizmi?</h4>
              <p className="text-xs text-muted-foreground">Ushbu amalni ortga qaytarib bo'lmaydi.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
              >
                Bekor qilish
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold text-white shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
              >
                {deleting ? 'O\'chirilmoqda...' : 'O\'chirish'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div 
        className="w-full bg-background border border-border rounded-t-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar"
        style={{ paddingBottom: 'calc(2rem + var(--sab, 0px))' }}
      >
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold">{editData ? 'Tahrirlash' : 'Tranzaksiya qo\'shish'}</h3>
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
                className="w-full bg-accent/50 border border-border rounded-xl px-4 py-4 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Kategoriya</label>
              <div className="relative">
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-accent/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all appearance-none text-sm font-bold"
                >
                  {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                    <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
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

          <div className="space-y-3">
            <button 
              type="submit"
              disabled={loading || deleting}
              className="w-full py-4 rpg-gradient rounded-2xl text-white font-bold uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Saqlanmoqda...' : editData ? 'O\'zgarishlarni saqlash' : 'Tranzaksiya qo\'shish'}
            </button>

            {editData && (
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading || deleting}
                className="w-full py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Tranzaksiyani o'chirish
              </button>
            )}
          </div>
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
          <h2 className="text-2xl font-bold uppercase tracking-tighter">Xabarlar</h2>
          <p className="text-muted-foreground text-sm">Tizim xabarlari va eslatmalar.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={markAllAsRead} 
            className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 hover:text-cyan-400 transition-colors"
          >
            Hammasini o'qish
          </button>
          <button 
            onClick={clearAll} 
            className="text-[10px] font-bold uppercase tracking-widest text-pink-500 hover:text-pink-400 transition-colors"
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
            <p className="text-muted-foreground text-sm">Yangi xabarlar yo'q.</p>
          </div>
        )}
      </div>
    </div>
  );
}
