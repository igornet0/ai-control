import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import styles from './Hero.module.css';
import logo from '../../assets/logo.png';
import dashboard from '../../assets/dashboard.png';
import Button from './Button';

const Hero = () => {

   const { user, isAuthenticated, loading, login, logout } = useAuth();

  return (
    <section className={styles.hero}>
      <div className={styles.left}>
        <img src={logo} alt="AI-Control Logo" className={styles.logo} />
        <h1 className={styles.title}>AI-CONTROL</h1>
        <h2>Optimizing Productivity<br />Through Smart Analytics</h2>
        <p>AI-Control provides businesses with efficient employee performance analyzed and customizable dashboards to.</p>
        <Link
          to={isAuthenticated ? `/profile` : `/signin`}
        >
          <Button text="Get Started" />
        </Link>
      </div>
      <div className={styles.right}>
        <img src={dashboard} alt="Dashboard" className={styles.dashboard} />
      </div>
    </section>
  );
};

export default Hero;