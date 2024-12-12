# Complete Implementation Guide - Lunch Box Notes MVP

## 1. Authentication System Implementation

### Setup Auth Context
```typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '@/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Auth Components

```typescript
// src/components/auth/SignUpForm.tsx
import { useState } from 'react';
import { auth, db } from '@/config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email,
        subscriptionStatus: 'free',
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <Button type="submit">Sign Up</Button>
    </form>
  );
}
```

### Protected Route Wrapper
```typescript
// src/components/auth/ProtectedRoute.tsx
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <div>Loading...</div>;
  
  if (!user) {
    router.push('/login');
    return null;
  }

  return <>{children}</>;
}
```

## 2. Note Generation System

### Claude API Integration
```typescript
// src/lib/claude/api.ts
import { auth } from '@/config/firebase';

interface NoteParams {
  category: string;
  ageGroup: string;
  length: 'short' | 'medium';
  interests?: string[];
}

export async function generateNote(params: NoteParams) {
  const token = await auth.currentUser?.getIdToken();
  
  const response = await fetch('/api/generate-note', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  return response.json();
}
```

### Note Generation Component
```typescript
// src/components/notes/NoteGenerator.tsx
import { useState } from 'react';
import { generateNote } from '@/lib/claude/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

export function NoteGenerator() {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('encouraging');

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateNote({
        category,
        ageGroup: '5-8',
        length: 'short',
      });
      setNote(result.note);
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Select
        value={category}
        onValueChange={setCategory}
        options={[
          { label: 'Encouraging', value: 'encouraging' },
          { label: 'Funny', value: 'funny' },
          { label: 'Educational', value: 'educational' },
        ]}
      />
      <Button onClick={handleGenerate} disabled={loading}>
        Generate Note
      </Button>
      {note && (
        <Card className="p-4">
          <p>{note}</p>
        </Card>
      )}
    </div>
  );
}
```

## 3. Subscription System

### Stripe Setup
```typescript
// src/lib/stripe/config.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
```

### Subscription Component
```typescript
// src/components/subscription/UpgradeButton.tsx
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

export function UpgradeButton() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.uid,
        }),
      });

      const { sessionId } = await response.json();
      // Redirect to Stripe checkout
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);
      await stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      console.error('Error:', error);
    }
    setLoading(false);
  };

  return (
    <Button onClick={handleUpgrade} disabled={loading}>
      Upgrade to Premium
    </Button>
  );
}
```

## 4. Essential UI Pages

### Landing Page
```typescript
// src/app/page.tsx
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Lunch Box Notes
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-gray-500 sm:text-lg md:mt-5 md:max-w-3xl md:text-xl">
            Create personalized notes for your child's lunch box
          </p>
          <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Dashboard Layout
```typescript
// src/components/layout/DashboardLayout.tsx
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

Would you like me to continue with:
1. API endpoint implementations?
2. Database utility functions?
3. Testing setup?
4. Deployment configuration?

Let me know what you'd like to see next!