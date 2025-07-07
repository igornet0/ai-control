import React, { ReactDOM, useState, useEffect, useRef } from 'react';
import { get_coins, get_coin_time_line } from '../../services/strategyService';
import { Chart as ChartJS, TimeScale, LinearScale, CategoryScale, Tooltip, Legend } from 'chart.js';
import ReactApexChart from "react-apexcharts";
import dateFormat, { masks } from "dateformat";
import 'chartjs-adapter-date-fns';
import { CandlestickElement, CandlestickController } from 'chartjs-chart-financial';
import { BarElement, BarController } from 'chart.js';
// import { FinancialChart } from 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';

// Регистрируем необходимые компоненты Chart.js
ChartJS.register(
  TimeScale,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  CandlestickElement,
  BarElement,
  CandlestickController,
  BarController,
  zoomPlugin  
);

const CoinsTabContent = () => {
  const [coins, setCoins] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState("");
  const [timeframe, setTimeframe] = useState('5m');
  const [last_timestamp, setTimestamp] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [volumeData, setVolumeData] = useState([]);
  const [currentPriceData, setCurrentPriceData] = useState(null)
  const [hasMoreData, setHasMoreData] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const chartRef = useRef(null);

  // Доступные таймфреймы
  const timeframes = [
    { value: '5m', label: '5 минут' },
    { value: '15m', label: '15 минут' },
    { value: '30m', label: '30 минут' },
    { value: '1h', label: '1 час' },
    { value: '4h', label: '4 часа' },
    { value: '1d', label: '1 день' },
    { value: '1w', label: '1 неделя' },
    { value: '1M', label: '1 месяц' },
    { value: '1y', label: '1 год' }
  ];

  // Загрузка списка монет
  useEffect(() => {
    const fetchCoins = async () => {
      try {
        setIsLoading(true);
        const data = await get_coins();

        setCoins(data);

        if (data.length > 0) {
          setSelectedCoin(data[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoins();
  }, []);

  // Загрузка данных для графика при изменении монеты или таймфрейма
  useEffect(() => {
    if (!selectedCoin || !chartData) return;

    const fetchCandleData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const data = await get_coin_time_line({ coin_id: selectedCoin.id, timeframe, last_timestamp: last_timestamp, 
          size_page: 500
        });

        // Преобразование данных для свечного графика
        const candleData = data.coin_data.map(item => ({
          x: new Date(item.datetime),
          o: item.open_price,
          h: item.max_price,
          l: item.min_price,
          c: item.close_price
        }));
        
        // Данные для объема
        const volData = data.coin_data.map(item => ({
          x: new Date(item.datetime),
          y: item.volume
        }));

        if (candleData.length > 0) {
          const lastCandle = candleData[candleData.length - 1];
          const prevCandle = candleData[candleData.length - 2] || lastCandle;
          const change = lastCandle.c - prevCandle.c;
          const changePercent = (change / prevCandle.c) * 100;

          // setTimestamp(dateFormat(candleData[0].x, "isoDateTime"));
        setTimestamp(data.last_timestamp)
          
        setCurrentPriceData({
            price: lastCandle.c,
            change,
            changePercent,
            volume: volData.reduce((sum, item) => sum + item.y, 0)
          });
        }

        setChartData(candleData);
        setVolumeData(volData);

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCandleData();
  }, [selectedCoin, timeframe]);

  const fetchMoreData = async () => {
    if (!hasMoreData || isFetchingMore || isLoading || !chartData.length) return;
    
    setIsFetchingMore(true);

    try {
      // Берем временную метку самой ранней точки
    //   const earliestTimestamp = chartData[0].x.getTime();
      
      const data = await get_coin_time_line({ 
        coin_id: selectedCoin.id, 
        timeframe, 
        last_timestamp: last_timestamp,
      });

      if (!data.coin_data || data.coin_data.length === 0) {
        setHasMoreData(false);
        return;
      }

      setTimestamp(data.last_timestamp)

      // Преобразование новых данных
      const newCandleData = data.coin_data.map(item => ({
        x: new Date(item.datetime),
        o: item.open_price,
        h: item.max_price,
        l: item.min_price,
        c: item.close_price
      }));

      const newVolumeData = data.coin_data.map(item => ({
        x: new Date(item.datetime),
        y: item.volume
      }));

      // Добавляем новые данные в начало
      setChartData(prev => [...newCandleData, ...prev]);
      setVolumeData(prev => [...newVolumeData, ...prev]);

    } catch (err) {
      setError("Ошибка загрузки дополнительных данных: " + err.message);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Обработчик прокрутки графика
  const handleScrolled = (chartContext, { xaxis }) => {
    if (!chartData.length) return;
    
    if (xaxis.min <= 20) {
      fetchMoreData();
    }
  };

  const selectCoin = (select_coin) => {
    setTimestamp(null);
    setChartData([]);
    setVolumeData([]);
    return setSelectedCoin(coins.find(coin => coin.id === Number(select_coin)));
  };

  const selectTimeframe = (select_timeframe) => {
    setChartData([])
    setVolumeData([]);
    setTimestamp(null)
    return setTimeframe(select_timeframe);
  };

  // Конфигурация графика
  const formatNumber = (value, decimals = 5) => {
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Функция для форматирования объема
  const formatVolume = (value) => {
    if (value >= 1000000) {
      return (value / 1000000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + 'K';
    }
    return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  };
  
  const chartConfig = [
    { 
        name: selectedCoin.name,
        label: selectedCoin.name,
        type: 'candlestick',
        data: chartData.map(item => ({
            x: item.x,
            y: [item.o, item.h, item.l, item.c]
            })) || [],
    }, 
    {
        name: 'Volume',
        type: 'column',
        data: volumeData.map(item => ({
            x: item.x,
            y: item.y
        })) || []
    }
  ];

  const options = {
        chart: {
            height: 500,
            type: 'candlestick',
            stacked: false,
            events: {
                scrolled: handleScrolled
            },
            zoom: {
              enabled: true,
              type: 'xy'
            }
        },
        title: {
            text: selectedCoin.name,
            align: 'left'
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            width: [1, 1, 4]
        },
        
        xaxis: {
            type: 'column',
            labels: {
                formatter: function(val) {
                    return dateFormat(val, "mmmm dS, yyyy, HH:MM:ss");
                }
            }
        },
        yaxis: [
                {
                  seriesName: selectedCoin.name,
                  axisTicks: {
                    show: true,
                  },
                  axisBorder: {
                    show: true,
                    color: '#008FFB'
                  },
                  labels: {
                    formatter: function(val) {
                        return val.toFixed(2);
                    },
                    style: {
                      colors: '#008FFB',
                    }
                  },
                  tooltip: {
                    enabled: true
                  }
                },
                {
                  seriesName: 'Volume',
                  opposite: true,
                  axisTicks: {
                    show: true,
                  },
                  axisBorder: {
                    show: true,
                    color: '#00E396'
                  },
                  labels: {
                    formatter: function(val) {
                        return val.toFixed(2);
                    },
                    style: {
                      colors: '#00E396',
                    }
                  },
                  title: {
                    text: "Volume",
                    style: {
                      color: '#00E396',
                    }
                  },
                }
              ],
        tooltip: {
            enabled: true,
            fixed: {
                enabled: true,
                position: 'topLeft', // topRight, topLeft, bottomRight, bottomLeft
                offsetY: 100,
                offsetX: 60
            },
            callbacks: {
                label: function(context) {
                const point = context.raw;
                
                if (context.datasetIndex === 0) {
                const open = point.o;
                const high = point.h;
                const low = point.l;
                const close = point.c;
                const change = close - open;
                const changePercent = (change / open) * 100;

                // Форматируем значения
                const formattedOpen = formatNumber(open);
                const formattedHigh = formatNumber(high);
                const formattedLow = formatNumber(low);
                const formattedClose = formatNumber(close);
                const formattedChange = formatNumber(Math.abs(change));
                const formattedChangePercent = Math.abs(changePercent).toFixed(2);

                // Определяем знак для изменения
                const changeSign = change < 0 ? '–' : '';
                const changePercentSign = changePercent < 0 ? '–' : '';

                return [
                    `open: ${formattedOpen}`,
                    `max: ${formattedHigh}`,
                    `min: ${formattedLow}`,
                    `close: ${formattedClose}`,
                    `change: ${changeSign}${formattedChange} (${changePercentSign}${formattedChangePercent}%)`
                ];
                } else {
                    return `Объём: ${formatVolume(point.y)}`;
                }
            },
            },
            displayColors: false,
            shared: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            bodyFont: {
            family: 'monospace',
            size: 13
            },
            zoom: {
                zoom: {
                    wheel: {
                    enabled: true,
                    },
                    pinch: {
                    enabled: true
                    },
                    mode: 'xy',
                }
            }
            },
            plugins: {
                legend: {
                    display: false,
                },
                // tooltip: {
                //     callbacks: {
                //     label: function(context) {
                //         const point = context.raw;
                        
                //         if (context.datasetIndex === 0) {
                //         const open = point.o;
                //         const high = point.h;
                //         const low = point.l;
                //         const close = point.c;
                //         const change = close - open;
                //         const changePercent = (change / open) * 100;

                //         // Форматируем значения
                //         const formattedOpen = formatNumber(open);
                //         const formattedHigh = formatNumber(high);
                //         const formattedLow = formatNumber(low);
                //         const formattedClose = formatNumber(close);
                //         const formattedChange = formatNumber(Math.abs(change));
                //         const formattedChangePercent = Math.abs(changePercent).toFixed(2);

                //         // Определяем знак для изменения
                //         const changeSign = change < 0 ? '–' : '';
                //         const changePercentSign = changePercent < 0 ? '–' : '';

                //         return [
                //             `open: ${formattedOpen}`,
                //             `max: ${formattedHigh}`,
                //             `min: ${formattedLow}`,
                //             `close: ${formattedClose}`,
                //             `change: ${changeSign}${formattedChange} (${changePercentSign}${formattedChangePercent}%)`
                //         ];
                //         } else {
                //         return `Объём: ${formatVolume(point.y)}`;
                //         }
                //     },
                //     title: function(context) {
                //         const date = new Date(context[0].raw.x);
                //         return date.toLocaleTimeString('ru-RU', { 
                //         hour: '2-digit', 
                //         minute: '2-digit',
                //         day: '2-digit',
                //         month: 'short',
                //         year: 'numeric'
                //         });
                //     }
                //     },
                //     displayColors: false,
                //     backgroundColor: 'rgba(0, 0, 0, 0.8)',
                //     padding: 12,
                //     bodyFont: {
                //     family: 'monospace',
                //     size: 13
                //     },
                //     zoom: {
                //         zoom: {
                //             wheel: {
                //             enabled: true,
                //             },
                //             pinch: {
                //             enabled: true
                //             },
                //             mode: 'xy',
                //         }
                //     }
                // }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
  };
    
  useEffect(() => {
    setHasMoreData(true);
    setIsFetchingMore(false);
  }, [selectedCoin, timeframe]);

  // Находим данные выбранной монеты
  const selectedCoinData = coins.find(coin => coin.id === selectedCoin.id);
  const coinName = selectedCoinData ? selectedCoinData.name : selectedCoin.name;
  
  // Находим метку текущего таймфрейма
  const currentTimeframe = timeframes.find(tf => tf.value === timeframe);
  const currentTimeframeLabel = currentTimeframe ? currentTimeframe.label : timeframe;

  const handleZoomed = (xaxis) => {
    if (!chartData.length || !xaxis.min) return;
    
    // Проверяем достижение начала данных
    if (xaxis.min <= chartData[0].x) {
      fetchMoreData();
    }
  };

  return (
    <div className="lg:col-span-3">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-800">
            {selectedCoin ? `${coinName} - ${currentTimeframeLabel}` : 'Анализ монет'}
          </h2>
          
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Выберите монету
              </label>
              <select
                value={selectedCoin.id}
                onChange={(e) => selectCoin(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                {coins.map(coin => (
                  <option key={coin.id} value={coin.id}>
                    {coin.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Таймфрейм
              </label>
              <div className="flex flex-wrap gap-1">
                {timeframes.map(tf => (
                  <button
                    key={tf.value}
                    onClick={() => selectTimeframe(tf.value)}
                    className={`px-3 py-1 text-sm rounded-md transition ${
                      timeframe === tf.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    disabled={isLoading}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {isLoading && (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {error && (
          <div className="h-96 flex flex-col items-center justify-center text-center p-6">
            <div className="text-red-500 text-lg mb-4">Ошибка: {error}</div>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {isFetchingMore && (
          <div className="text-center py-2 bg-blue-50">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              Загрузка предыдущих данных...
            </div>
          </div>
        )}
        
        {!isLoading && !error && chartData && (
        //   <div className="h-[350px]">
        //     {/* <Chart type="candlestick" data={chartConfig} options={options} /> */}
        //     <ReactApexChart options={options} series={chartConfig} type="candlestick" height={350} />
        //   </div>
            <div className="h-[350px]">
                <ReactApexChart 
                // ref={chartRef}
                options={options} 
                series={chartConfig} 
                type="candlestick" 
                height={350} 
                />
            </div>
        )}
        
        {!isLoading && !error && !chartData && (
          <div className="h-96 flex items-center justify-center">
            <p className="text-gray-500">Нет данных для отображения</p>
          </div>
        )}
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-700 mb-1">Текущая цена</div>
            <div className="text-xl font-bold">
              {chartData?.length ? `${chartData[chartData.length - 1].c.toFixed(2)}` : '-'}$
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-700 mb-1">Изменение (24ч)</div>
            <div className="text-xl font-bold">
              {chartData?.length > 1 
                ? `${((chartData[chartData.length - 1].c / chartData[chartData.length - 2].c - 1) * 100).toFixed(2)}%` 
                : '-'}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-purple-700 mb-1">Объем (24ч)</div>
            <div className="text-xl font-bold">
              {volumeData?.length 
                ? `${volumeData.reduce((sum, item) => sum + item.y, 0).toFixed(2)}` 
                : '-'}$
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-yellow-700 mb-1">Волатильность</div>
            <div className="text-xl font-bold">
              {chartData?.length 
                ? `${(Math.max(...chartData.map(c => c.h)) - Math.min(...chartData.map(c => c.l))).toFixed(2)}` 
                : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
const domContainer = document.querySelector('#app');
if (domContainer) {
  ReactDOM.render(<CoinsTabContent />, domContainer);
}

export default CoinsTabContent;