import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';
import df_dashboard from '../assets/default_dashboard.png';

const dummyDashboards = [
  { id: 1, 
    img: df_dashboard,
    name: 'Sales Dashboard' },
  { id: 2, 
    img: df_dashboard,
    name: 'Marketing Dashboard' },
  { id: 3, 
    img: df_dashboard,
    name: 'HR Dashboard' },
];

const DashboardList = () => {
  const { user } = useAuth();

  return (
    <div style={{ padding: '20px', backgroundColor: '#142e2e' }}>
      <h3>Your Dashboards:</h3>
      <ul>
        {dummyDashboards.map((dashboard) => (
          <li key={dashboard.id} className={styles.dashboardItem}>
            <Link to={`/dashboard/${dashboard.id}`} className={styles.dashboardLink}>
                <img src={dashboard.img} alt={dashboard.name} className={styles.dashboardImage} />
                <h3 className={styles.dashboardName}>{dashboard.name}</h3>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DashboardList;