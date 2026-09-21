import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api/v1';

const LIMIT_DATA = 50;

const STATUS_LAPORAN = [
  'Batal',
  'Konfirmasi',
  'Dalam Proses Pengiriman Email',
  'Menunggu Tanggapan Supervisor CC',
  'Dalam Proses Manager Unit',
  'Dalam Proses Bidang Unit',
  'Selesai Dijawab Bidang Unit',
  'Selesai',
];

export default function Dashboard() {
  const getTodayDateString = () => {
    const d = new Date();

    const tahun = d.getFullYear();
    const bulan = String(
      d.getMonth() + 1
    ).padStart(2, '0');

    const tanggal = String(
      d.getDate()
    ).padStart(2, '0');

    return `${tahun}-${bulan}-${tanggal}`;
  };

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const [authChecking, setAuthChecking] =
    useState(true);

  const [userData, setUserData] =
    useState(null);

  const [showLoginModal, setShowLoginModal] =
    useState(false);

  const [selectedUid, setSelectedUid] =
    useState('');

  const [selectedUserId, setSelectedUserId] =
    useState('');

  const [selectedUp3, setSelectedUp3] =
    useState('');

  const [selectedUlp, setSelectedUlp] =
    useState('');

  const [username, setUsername] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [captchaInput, setCaptchaInput] =
    useState('');

  const [captchaImage, setCaptchaImage] =
    useState('');

  const [captchaLoading, setCaptchaLoading] =
    useState(false);

  const [loginLoading, setLoginLoading] =
    useState(false);

  const [waktuKomputer, setWaktuKomputer] =
    useState('');

  const [listUp3, setListUp3] =
    useState([]);

  const [listUlp, setListUlp] =
    useState([]);

  const [dataKeluhan, setDataKeluhan] =
    useState([]);

  const [totalData, setTotalData] =
    useState(0);

  const [totalHalaman, setTotalHalaman] =
    useState(0);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [loadingTabel, setLoadingTabel] =
    useState(false);

  const [errorStatus, setErrorStatus] =
    useState('');

  const [selectedStatus, setSelectedStatus] =
    useState('');

  const [tanggalMulai, setTanggalMulai] =
    useState(getTodayDateString());

  const [tanggalSelesai, setTanggalSelesai] =
    useState(getTodayDateString());

  const [searchField, setSearchField] =
    useState('no_laporan');

  const [searchQuery, setSearchQuery] =
    useState('');

  const [activeSearchFilters, setActiveSearchFilters] =
    useState({});

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();

      setWaktuKomputer(
        `${now.toLocaleTimeString('id-ID')} WIB`
      );
    };

    updateClock();

    const timer = setInterval(
      updateClock,
      1000
    );

    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleSessionExpired = () => {
    setIsLoggedIn(false);
    setUserData(null);

    setSelectedUid('');
    setSelectedUserId('');
    setSelectedUp3('');
    setSelectedUlp('');

    setListUp3([]);
    setListUlp([]);

    setDataKeluhan([]);
    setTotalData(0);
    setTotalHalaman(0);
    setCurrentPage(1);

    setErrorStatus(
      'Sesi login telah kedaluwarsa. Silahkan login kembali.'
    );

    setShowLoginModal(true);
  };

  const checkBackendSession = async () => {
    setAuthChecking(true);
    setErrorStatus('');

    try {
      const response = await axios.get(
        `${API_BASE_URL}/auth/status`,
        {
          timeout: 10000,
        }
      );

      if (
        response.data?.status !== true ||
        response.data?.loggedIn !== true ||
        !response.data?.user
      ) {
        setIsLoggedIn(false);
        setUserData(null);

        return;
      }

      const user =
        response.data.user;

      setUserData(user);
      setIsLoggedIn(true);

      setSelectedUid(
        user.idUid != null
          ? String(user.idUid)
          : ''
      );

      setSelectedUserId(
        user.userId != null
          ? String(user.userId)
          : ''
      );

      setSelectedUp3(
        user.idUp3 != null
          ? String(user.idUp3)
          : ''
      );

      setSelectedUlp(
        user.idUlp != null
          ? String(user.idUlp)
          : ''
      );

      const missingIds = [];

      if (
        user.idUid === undefined ||
        user.idUid === null
      ) {
        missingIds.push('idUid');
      }

      if (
        user.userId === undefined ||
        user.userId === null
      ) {
        missingIds.push('userId');
      }

      if (
        user.idUp3 === undefined ||
        user.idUp3 === null
      ) {
        missingIds.push('idUp3');
      }

      if (
        user.idUlp === undefined ||
        user.idUlp === null
      ) {
        missingIds.push('idUlp');
      }

      if (missingIds.length > 0) {
        setErrorStatus(
          `Data session tidak lengkap: ${missingIds.join(
            ', '
          )}`
        );
      }

    } catch (error) {

      if (
        error.response?.status === 401
      ) {
        setIsLoggedIn(false);
        setUserData(null);

        return;
      }

      console.error(
        'Gagal mengecek session backend:',
        error
      );

      setErrorStatus(
        'Tidak dapat memeriksa status session backend.'
      );

    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkBackendSession();
  }, []);

  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    setCaptchaImage('');

    try {
      const response = await axios.get(
        `${API_BASE_URL}/auth/captcha`,
        {
          timeout: 10000,
        }
      );

      if (response.data?.image) {
        setCaptchaImage(
          response.data.image
        );
      }

    } catch (error) {

      console.error(
        'Gagal memuat captcha:',
        error
      );

    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    if (showLoginModal) {
      loadCaptcha();
    }
  }, [showLoginModal]);

  const handleProcessLogin = async (e) => {
    e.preventDefault();

    if (loginLoading) {
      return;
    }

    setLoginLoading(true);
    setErrorStatus('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          username,
          password,
          captcha: captchaInput,
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );

      if (
        response.data?.status === true &&
        response.data?.user
      ) {
        const user =
          response.data.user;

        setUserData(user);
        setIsLoggedIn(true);

        setSelectedUid(
          user.idUid != null
            ? String(user.idUid)
            : ''
        );

        setSelectedUserId(
          user.userId != null
            ? String(user.userId)
            : ''
        );

        setSelectedUp3(
          user.idUp3 != null
            ? String(user.idUp3)
            : ''
        );

        setSelectedUlp(
          user.idUlp != null
            ? String(user.idUlp)
            : ''
        );

        setShowLoginModal(false);

        setPassword('');
        setCaptchaInput('');

        alert(
          `Selamat Datang, ${
            user.employeeName ||
            user.username ||
            'User'
          }!`
        );

      } else {

        alert(
          response.data?.message ||
          'Login gagal.'
        );

        loadCaptcha();
      }

    } catch (error) {

      console.error(
        'Login error:',
        error
      );

      alert(
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Terjadi kesalahan saat login.'
      );

      loadCaptcha();

    } finally {
      setLoginLoading(false);
    }
  };

  const fetchMasterUp3 = async () => {
    if (
      !isLoggedIn ||
      !selectedUid
    ) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/master/up3`,
        {
          id_uid: Number(selectedUid),
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );

      const result =
        response.data?.data
          ?.getUp3ByUid;

      if (
        result?.status === true &&
        Array.isArray(result.data)
      ) {
        setListUp3(
          result.data
        );

      } else {

        setListUp3([]);

        setErrorStatus(
          result?.message ||
          'Data UP3 tidak ditemukan.'
        );
      }

    } catch (error) {

      console.error(
        'Gagal mengambil UP3:',
        error
      );

      if (
        error.response?.status === 401
      ) {
        handleSessionExpired();
        return;
      }

      setErrorStatus(
        error.response?.data?.message ||
        'Gagal mengambil data UP3.'
      );
    }
  };

  useEffect(() => {
    if (
      !authChecking &&
      isLoggedIn &&
      selectedUid
    ) {
      fetchMasterUp3();
    }
  }, [
    authChecking,
    isLoggedIn,
    selectedUid,
  ]);

  const fetchMasterUlp = async () => {
    if (
      !isLoggedIn ||
      !selectedUp3
    ) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/master/ulp`,
        {
          id_up3: Number(selectedUp3),
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );

      const ulpList =
        response.data?.data
          ?.getUlpByUp3;

      if (
        Array.isArray(ulpList)
      ) {
        setListUlp(
          ulpList
        );
      } else {
        setListUlp([]);
      }

    } catch (error) {

      console.error(
        'Gagal mengambil ULP:',
        error
      );

      if (
        error.response?.status === 401
      ) {
        handleSessionExpired();
        return;
      }

      setErrorStatus(
        error.response?.data?.message ||
        'Gagal mengambil data ULP.'
      );
    }
  };

  useEffect(() => {
    if (
      !authChecking &&
      isLoggedIn &&
      selectedUp3
    ) {
      fetchMasterUlp();
    }
  }, [
    authChecking,
    isLoggedIn,
    selectedUp3,
  ]);

  const buildKeluhanPayload = (
    page = 1
  ) => {
    const payload = {
      id_uid:
        Number(selectedUid),

      user_id:
        Number(selectedUserId),

      id_up3:
        Number(selectedUp3),

      id_ulp:
        Number(selectedUlp),

      tanggal_mulai:
        tanggalMulai,

      tanggal_selesai:
        tanggalSelesai,

      status:
        selectedStatus || null,

      no_laporan:
        activeSearchFilters.no_laporan ||
        null,

      nama_pelapor:
        activeSearchFilters.nama_pelapor ||
        null,

      id_pelanggan:
        activeSearchFilters.id_pelanggan ||
        null,

      no_meter:
        activeSearchFilters.no_meter ||
        null,

      limit:
        LIMIT_DATA,

      skip:
        (page - 1) *
        LIMIT_DATA,
    };

    return payload;
  };

  const validateKeluhanRequest = () => {
    const missing = [];

    if (!selectedUid) {
      missing.push('ID UID');
    }

    if (!selectedUserId) {
      missing.push('User ID');
    }

    if (!selectedUp3) {
      missing.push('UP3');
    }

    if (!selectedUlp) {
      missing.push('ULP');
    }

    if (!tanggalMulai) {
      missing.push('Tanggal Mulai');
    }

    if (!tanggalSelesai) {
      missing.push('Tanggal Selesai');
    }

    if (missing.length > 0) {
      setErrorStatus(
        `Parameter belum lengkap: ${missing.join(
          ', '
        )}`
      );

      return false;
    }

    return true;
  };

  const handleCariDataKeluhan = async (
    page = 1
  ) => {

    if (!isLoggedIn) {
      setShowLoginModal(true);

      return;
    }

    if (
      !validateKeluhanRequest()
    ) {
      return;
    }

    setLoadingTabel(true);
    setErrorStatus('');

    const payload =
      buildKeluhanPayload(page);

    console.log(
      '📤 POST /api/v1/keluhan:',
      payload
    );

    try {
      const response = await axios.post(
        `${API_BASE_URL}/keluhan`,
        payload,
        {
          timeout: 20000,

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );

      if (
        response.data?.status === true
      ) {
        setDataKeluhan(
          Array.isArray(
            response.data.data_keluhan
          )
            ? response.data.data_keluhan
            : []
        );

        setTotalData(
          Number(
            response.data.total_data ||
            0
          )
        );

        setTotalHalaman(
          Number(
            response.data.total_halaman ||
            0
          )
        );

        setCurrentPage(page);

      } else {

        setDataKeluhan([]);
        setTotalData(0);
        setTotalHalaman(0);

        setErrorStatus(
          response.data?.message ||
          'Backend mengembalikan status false.'
        );
      }

    } catch (error) {

      console.error(
        'Gagal mengambil data keluhan:',
        error
      );

      if (
        error.response?.status === 401
      ) {
        handleSessionExpired();
        return;
      }

      if (
        error.response?.status === 400
      ) {
        const errors =
          error.response.data?.errors;

        if (
          Array.isArray(errors)
        ) {
          setErrorStatus(
            errors
              .map(
                (item) =>
                  item.message ||
                  item.extensions?.message ||
                  JSON.stringify(item)
              )
              .join(' | ')
          );
        } else {
          setErrorStatus(
            error.response.data?.message ||
            'Request tidak valid.'
          );
        }

        return;
      }

      setErrorStatus(
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Gagal mengambil data keluhan.'
      );

    } finally {
      setLoadingTabel(false);
    }
  };

  useEffect(() => {

    if (
      !authChecking &&
      isLoggedIn &&
      selectedUid &&
      selectedUserId &&
      selectedUp3 &&
      selectedUlp &&
      tanggalMulai &&
      tanggalSelesai
    ) {
      handleCariDataKeluhan(1);
    }

  }, [
    authChecking,
    isLoggedIn,
    selectedUid,
    selectedUserId,
    selectedUp3,
    selectedUlp,
    selectedStatus,
    activeSearchFilters,
  ]);

  const handleTambahKriteria = () => {

    const value =
      searchQuery.trim();

    if (!value) {
      return;
    }

    setActiveSearchFilters(
      (previous) => ({
        ...previous,
        [searchField]: value,
      })
    );

    setSearchQuery('');

    setCurrentPage(1);
  };

  const handleHapusKriteria = (
    field
  ) => {

    setActiveSearchFilters(
      (previous) => {
        const updated = {
          ...previous,
        };

        delete updated[field];

        return updated;
      }
    );

    setCurrentPage(1);
  };

  const handleChangeUp3 = (value) => {

    setSelectedUp3(value);

    setSelectedUlp('');

    setListUlp([]);

    setDataKeluhan([]);

    setTotalData(0);
    setTotalHalaman(0);

    setCurrentPage(1);
  };

  const handleResetForm = () => {

    setSelectedStatus('');

    setTanggalMulai(
      getTodayDateString()
    );

    setTanggalSelesai(
      getTodayDateString()
    );

    setActiveSearchFilters({});

    setSearchQuery('');

    setCurrentPage(1);
  };

  const handlePreviousPage = () => {

    if (
      currentPage <= 1 ||
      loadingTabel
    ) {
      return;
    }

    handleCariDataKeluhan(
      currentPage - 1
    );
  };

  const handleNextPage = () => {

    if (
      currentPage >= totalHalaman ||
      loadingTabel
    ) {
      return;
    }

    handleCariDataKeluhan(
      currentPage + 1
    );
  };

  const getStatusClass = (
    status
  ) => {

    switch (status) {

      case 'Batal':
        return 'bg-red-100 text-red-700';

      case 'Konfirmasi':
        return 'bg-yellow-100 text-yellow-700';

      case 'Dalam Proses Pengiriman Email':
        return 'bg-blue-100 text-blue-700';

      case 'Menunggu Tanggapan Supervisor CC':
        return 'bg-purple-100 text-purple-700';

      case 'Dalam Proses Manager Unit':
        return 'bg-orange-100 text-orange-700';

      case 'Dalam Proses Bidang Unit':
        return 'bg-cyan-100 text-cyan-700';

      case 'Selesai Dijawab Bidang Unit':
        return 'bg-indigo-100 text-indigo-700';

      case 'Selesai':
        return 'bg-green-100 text-green-700';

      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getSearchFieldLabel = (
    field
  ) => {

    switch (field) {

      case 'no_laporan':
        return 'No Laporan';

      case 'nama_pelapor':
        return 'Nama Pelapor';

      case 'id_pelanggan':
        return 'ID Pelanggan';

      case 'no_meter':
        return 'No Meter';

      default:
        return field;
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f5] font-sans text-gray-800 text-sm flex flex-col">

      <header className="h-14 bg-white border-b border-gray-300 px-6 flex items-center justify-between shadow-sm shrink-0">

        <div className="flex items-center gap-4">

          <div className="flex items-center gap-2">

            <div className="text-xl text-yellow-500 font-bold">
              ⚡
            </div>

            <h3 className="font-bold text-sm text-[#00667e] tracking-tight uppercase">
              APKT Monitoring
            </h3>

          </div>

          <div className="flex items-center gap-2 text-xs bg-red-50 text-red-600 px-3 py-1 rounded border border-red-200 font-medium">

            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />

            <span>
              {waktuKomputer ||
                'Memuat Jam...'}
            </span>

          </div>

        </div>

        <div>

          {authChecking ? (

            <div className="flex items-center gap-2 bg-gray-100 text-gray-500 px-4 py-1.5 rounded-full text-xs font-semibold">

              <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />

              <span>
                Memeriksa sesi...
              </span>

            </div>

          ) : !isLoggedIn ? (

            <button
              type="button"
              onClick={() =>
                setShowLoginModal(true)
              }
              className="bg-[#028090] hover:bg-[#026673] text-white font-semibold text-xs px-4 py-2 rounded-md shadow flex items-center gap-1.5"
            >
              🔑 Login User
            </button>

          ) : (

            <div className="flex items-center gap-2 bg-[#005f73] text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow">

              <span className="w-2 h-2 rounded-full bg-green-400" />

              <span>
                {userData?.username ||
                  userData?.employeeName ||
                  'User'}
              </span>

            </div>
          )}

        </div>

      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-4 min-w-0">

        {errorStatus && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded text-xs font-semibold shadow-sm flex items-start gap-2">

            <span>
              ⚠️
            </span>

            <span className="flex-1">
              {errorStatus}
            </span>

            <button
              type="button"
              onClick={() =>
                setErrorStatus('')
              }
              className="font-bold"
            >
              ×
            </button>

          </div>
        )}

        <div className="bg-white rounded-md border border-gray-300 p-4 shadow-sm space-y-4">

          <div className="flex flex-wrap gap-2">

            <div className="flex border border-gray-300 rounded overflow-hidden flex-1 max-w-2xl">

              <input
                type="text"
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter'
                  ) {
                    e.preventDefault();

                    handleTambahKriteria();
                  }
                }}
                placeholder="Masukkan kriteria pencarian..."
                className="px-3 py-2 text-xs outline-none flex-1"
              />

              <select
                value={searchField}
                onChange={(e) =>
                  setSearchField(
                    e.target.value
                  )
                }
                className="border-l border-gray-300 px-3 py-2 text-xs bg-white outline-none"
              >
                <option value="no_laporan">
                  No Laporan
                </option>

                <option value="nama_pelapor">
                  Nama Pelapor
                </option>

                <option value="id_pelanggan">
                  ID Pelanggan
                </option>

                <option value="no_meter">
                  No Meter
                </option>
              </select>

            </div>

            <button
              type="button"
              onClick={
                handleTambahKriteria
              }
              className="bg-[#028090] hover:bg-[#026673] text-white px-4 py-2 rounded text-xs font-semibold"
            >
              + Tambah Kriteria
            </button>

          </div>

          <div className="flex flex-wrap gap-2">

            {Object.keys(
              activeSearchFilters
            ).length === 0 ? (

              <span className="text-xs text-gray-400 italic">
                Belum ada filter teks
                pencarian.
              </span>

            ) : (

              Object.entries(
                activeSearchFilters
              ).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center bg-[#005f73] text-white px-3 py-1.5 rounded-full text-xs"
                  >

                    <span>
                      {getSearchFieldLabel(
                        key
                      )}
                      : {value}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleHapusKriteria(
                          key
                        )
                      }
                      className="ml-2 text-cyan-200 hover:text-white font-bold"
                    >
                      ×
                    </button>

                  </div>
                )
              )

            )}

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

            <div>

              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Unit UP3
              </label>

              <select
                value={selectedUp3}
                onChange={(e) =>
                  handleChangeUp3(
                    e.target.value
                  )
                }
                disabled={
                  !isLoggedIn ||
                  listUp3.length === 0
                }
                className="w-full border border-gray-300 rounded p-2 bg-white text-xs outline-none disabled:bg-gray-100"
              >

                <option value="">
                  Pilih UP3
                </option>

                {listUp3
                  .filter(
                    (up3) =>
                      up3.aktif !== false
                  )
                  .map((up3) => (
                    <option
                      key={up3.id}
                      value={up3.id}
                    >
                      {up3.nama}
                    </option>
                  ))}

              </select>

            </div>

            <div>

              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Unit Layanan Pelanggan (ULP)
              </label>

              <select
                value={selectedUlp}
                onChange={(e) => {

                  setSelectedUlp(
                    e.target.value
                  );

                  setCurrentPage(1);

                }}
                disabled={
                  !isLoggedIn ||
                  listUlp.length === 0
                }
                className="w-full border border-gray-300 rounded p-2 bg-white text-xs outline-none disabled:bg-gray-100"
              >

                <option value="">
                  Pilih ULP
                </option>

                {listUlp
                  .filter(
                    (ulp) =>
                      ulp.aktif !== false
                  )
                  .map((ulp) => (
                    <option
                      key={ulp.id}
                      value={ulp.id}
                    >
                      {ulp.nama}
                    </option>
                  ))}

              </select>

            </div>

            <div>

              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Status Akhir Laporan
              </label>

              <select
                value={selectedStatus}
                onChange={(e) => {

                  setSelectedStatus(
                    e.target.value
                  );

                  setCurrentPage(1);

                }}
                disabled={!isLoggedIn}
                className="w-full border border-gray-300 rounded p-2 bg-white text-xs outline-none disabled:bg-gray-100"
              >

                <option value="">
                  Semua Status
                </option>

                {STATUS_LAPORAN.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}

              </select>

            </div>

            <div className="flex items-end gap-2">

              <button
                type="button"
                onClick={
                  handleResetForm
                }
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                🔄 Reset
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCariDataKeluhan(
                    1
                  )
                }
                disabled={
                  !isLoggedIn ||
                  loadingTabel
                }
                className="flex-1 bg-[#028090] hover:bg-[#026673] disabled:bg-gray-400 text-white rounded px-3 py-2 text-xs font-semibold"
              >
                {loadingTabel
                  ? 'Memuat...'
                  : 'Cari'}
              </button>

            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            <div>

              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Mulai Tanggal
              </label>

              <input
                type="date"
                value={tanggalMulai}
                onChange={(e) => {

                  setTanggalMulai(
                    e.target.value
                  );

                  setCurrentPage(1);

                }}
                disabled={!isLoggedIn}
                className="w-full border border-gray-300 rounded p-2 text-xs outline-none disabled:bg-gray-100"
              />

            </div>

            <div>

              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Sampai Tanggal
              </label>

              <input
                type="date"
                value={tanggalSelesai}
                onChange={(e) => {

                  setTanggalSelesai(
                    e.target.value
                  );

                  setCurrentPage(1);

                }}
                disabled={!isLoggedIn}
                className="w-full border border-gray-300 rounded p-2 text-xs outline-none disabled:bg-gray-100"
              />

            </div>

          </div>

          {isLoggedIn && (
            <div className="border-t border-gray-200 pt-3 flex flex-wrap gap-4 text-[11px] text-gray-500">

              <span>
                UID:{' '}
                <strong>
                  {selectedUid || '-'}
                </strong>
              </span>

              <span>
                User ID:{' '}
                <strong>
                  {selectedUserId || '-'}
                </strong>
              </span>

              <span>
                UP3:{' '}
                <strong>
                  {selectedUp3 || '-'}
                </strong>
              </span>

              <span>
                ULP:{' '}
                <strong>
                  {selectedUlp || '-'}
                </strong>
              </span>

            </div>
          )}

        </div>

        <div className="bg-white rounded-md border border-gray-300 shadow-sm overflow-hidden">

          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">

            <div>

              <h2 className="font-bold text-sm text-[#00667e]">
                Daftar Keluhan
              </h2>

              {userData && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {userData.employeeName ||
                    userData.username ||
                    '-'}
                </p>
              )}

            </div>

            <div className="text-xs text-gray-500 text-right">

              <div>
                Total:{' '}
                <strong>
                  {totalData}
                </strong>
              </div>

              {totalHalaman > 0 && (
                <div className="mt-0.5">
                  Halaman{' '}
                  <strong>
                    {currentPage}
                  </strong>{' '}
                  /{' '}
                  <strong>
                    {totalHalaman}
                  </strong>
                </div>
              )}

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-full text-xs">

              <thead className="bg-[#005f73] text-white">

                <tr>

                  <th className="px-3 py-3 text-left">
                    No
                  </th>

                  <th className="px-3 py-3 text-left">
                    No. Laporan
                  </th>

                  <th className="px-3 py-3 text-left">
                    Nama Pelapor
                  </th>

                  <th className="px-3 py-3 text-left">
                    Permasalahan
                  </th>

                  <th className="px-3 py-3 text-left">
                    Waktu Lapor
                  </th>

                  <th className="px-3 py-3 text-left">
                    Status Akhir
                  </th>

                  <th className="px-3 py-3 text-left">
                    ULP
                  </th>

                  <th className="px-3 py-3 text-left">
                    Meter / ID Pelanggan
                  </th>

                  <th className="px-3 py-3 text-left">
                    Alamat
                  </th>

                </tr>

              </thead>

              <tbody>

                {loadingTabel && (
                  <tr>

                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-gray-500"
                    >

                      <div className="flex flex-col items-center gap-2">

                        <div className="w-5 h-5 border-2 border-gray-300 border-t-[#028090] rounded-full animate-spin" />

                        <span>
                          Sedang mengambil data...
                        </span>

                      </div>

                    </td>

                  </tr>
                )}

                {!loadingTabel &&
                  !isLoggedIn && (
                    <tr>

                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-gray-500"
                      >

                        <div className="flex flex-col items-center gap-3">

                          <div className="text-3xl">
                            🔒
                          </div>

                          <span>
                            Silahkan login
                            terlebih dahulu.
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setShowLoginModal(
                                true
                              )
                            }
                            className="bg-[#028090] hover:bg-[#026673] text-white px-4 py-2 rounded text-xs font-semibold"
                          >
                            🔑 Login Petugas
                          </button>

                        </div>

                      </td>

                    </tr>
                  )}

                {!loadingTabel &&
                  isLoggedIn &&
                  dataKeluhan.length ===
                    0 && (
                    <tr>

                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-gray-500"
                      >
                        Tidak ada data keluhan
                        untuk filter yang
                        dipilih.
                      </td>

                    </tr>
                  )}

                {!loadingTabel &&
                  isLoggedIn &&
                  dataKeluhan.length > 0 &&
                  dataKeluhan.map(
                    (item, index) => {

                      const noMeter =
                        item
                          .pelanggan_no_meter
                          ?.no_meter ||
                        '-';

                      const idPelanggan =
                        item
                          .pelanggan_no_meter
                          ?.id_pelanggan ||
                        '-';

                      const status =
                        item.status_akhir ||
                        '-';

                      return (
                        <tr
                          key={
                            item.id ??
                            item.no_laporan ??
                            index
                          }
                          className="border-b border-gray-100 hover:bg-gray-50 align-top"
                        >

                          <td className="px-3 py-3">
                            {(
                              (currentPage - 1) *
                              LIMIT_DATA
                            ) +
                              index +
                              1}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap font-semibold text-[#00667e]">
                            {item.no_laporan ||
                              '-'}
                          </td>

                          <td className="px-3 py-3">
                            {item.nama_pelapor ||
                              'Tanpa Nama'}
                          </td>

                          <td className="px-3 py-3 min-w-[250px] max-w-[450px]">
                            {item.permasalahan ||
                              '-'}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {item.waktu_lapor ||
                              '-'}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">

                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusClass(
                                status
                              )}`}
                            >
                              {status}
                            </span>

                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {item.master_ulp
                              ?.nama ||
                              '-'}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">

                            <div>
                              {noMeter}
                            </div>

                            <div className="text-gray-400 mt-0.5">
                              {idPelanggan}
                            </div>

                          </td>

                          <td className="px-3 py-3 min-w-[250px]">
                            {item.alamat_pelanggan ||
                              '-'}
                          </td>

                        </tr>
                      );
                    }
                  )}

              </tbody>

            </table>

          </div>

          {isLoggedIn &&
            totalHalaman > 0 && (

              <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">

                <button
                  type="button"
                  onClick={
                    handlePreviousPage
                  }
                  disabled={
                    currentPage <= 1 ||
                    loadingTabel
                  }
                  className="px-3 py-1.5 rounded border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  ← Sebelumnya
                </button>

                <span className="text-xs text-gray-500">
                  Halaman{' '}
                  <strong>
                    {currentPage}
                  </strong>{' '}
                  /{' '}
                  <strong>
                    {totalHalaman}
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={
                    handleNextPage
                  }
                  disabled={
                    currentPage >=
                      totalHalaman ||
                    loadingTabel
                  }
                  className="px-3 py-1.5 rounded border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  Berikutnya →
                </button>

              </div>
            )}

        </div>

      </main>

      {showLoginModal && (

        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">

          <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl">

            <button
              type="button"
              onClick={() =>
                setShowLoginModal(false)
              }
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>

            <div className="px-6 py-5 border-b border-gray-200">

              <h2 className="text-base font-bold text-[#005f73]">
                Autentikasi Server APKT
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                Masukkan akun PLN Anda
                untuk mendapatkan session.
              </p>

            </div>

            <form
              onSubmit={
                handleProcessLogin
              }
              className="p-6 space-y-4"
            >

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Username NIP
                </label>

                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  placeholder="Contoh: 16100.AZIS"
                  autoComplete="username"
                  className="w-full p-2.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />

              </div>

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Password
                </label>

                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full p-2.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />

              </div>

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Verifikasi Captcha
                </label>

                <div className="border border-gray-300 rounded p-3 bg-gray-50 flex items-center justify-center min-h-[80px]">

                  {captchaLoading ? (

                    <div className="flex items-center gap-2 text-xs text-gray-400">

                      <div className="w-4 h-4 border-2 border-gray-300 border-t-[#028090] rounded-full animate-spin" />

                      <span>
                        Memuat gambar...
                      </span>

                    </div>

                  ) : captchaImage ? (

                    <img
                      src={captchaImage}
                      alt="Captcha"
                      className="max-h-16 max-w-full object-contain"
                    />

                  ) : (

                    <span className="text-xs text-red-500">
                      Gagal memuat captcha
                    </span>

                  )}

                </div>

                <button
                  type="button"
                  onClick={loadCaptcha}
                  disabled={
                    captchaLoading
                  }
                  className="mt-2 text-xs text-[#028090] hover:text-[#026673] font-semibold"
                >
                  🔄 Muat Ulang Captcha
                </button>

              </div>

              <div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Kode Captcha
                </label>

                <input
                  type="text"
                  required
                  value={captchaInput}
                  onChange={(e) =>
                    setCaptchaInput(
                      e.target.value
                    )
                  }
                  placeholder="Masukkan kode captcha"
                  className="w-full p-2.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

              <div className="flex gap-2 pt-2">

                <button
                  type="button"
                  onClick={() => {

                    setShowLoginModal(
                      false
                    );

                    setPassword('');
                    setCaptchaInput('');

                  }}
                  className="w-1/3 border border-gray-300 rounded text-xs font-semibold text-gray-600 hover:bg-gray-50 py-2.5"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    loginLoading ||
                    captchaLoading
                  }
                  className="flex-1 bg-[#028090] hover:bg-[#026673] disabled:bg-gray-400 text-white rounded text-xs font-semibold py-2.5"
                >
                  {loginLoading
                    ? 'Memproses...'
                    : 'Login'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}
