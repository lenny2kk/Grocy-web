import { useState } from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';

export const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);

  return (
    <>
      {isRegister ? (
        <AuthLayout 
          title="Utwórz nowe konto" 
          subtitle="Zorganizuj swoją spiżarnię i listy zakupów już dziś"
        >
          <RegisterForm onSwitchToLogin={() => setIsRegister(false)} />
        </AuthLayout>
      ) : (
        <AuthLayout 
          title="Zaloguj się do spiżarni" 
          subtitle="Twój domowy organizer zakupów w czasie rzeczywistym"
        >
          <LoginForm onSwitchToRegister={() => setIsRegister(true)} />
        </AuthLayout>
      )}
    </>
  );
};

export default AuthPage;
