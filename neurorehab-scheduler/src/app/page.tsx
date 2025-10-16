'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Bell, Settings, Plus, Edit, Trash2 } from 'lucide-react';

interface Appointment {
  id: string;
  patientName: string;
  therapist: string;
  date: string;
  time: string;
  type: 'initial' | 'follow-up' | 'assessment';
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export default function NeuroRehabScheduler() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    patientName: '',
    therapist: '',
    date: selectedDate,
    time: '',
    type: 'initial' as 'initial' | 'follow-up' | 'assessment',
    notes: ''
  });

  // 샘플 데이터
  useEffect(() => {
    const sampleAppointments: Appointment[] = [
      {
        id: '1',
        patientName: '김환자',
        therapist: '함형광',
        date: '2024-01-15',
        time: '09:00',
        type: 'initial',
        status: 'scheduled',
        notes: '뇌졸중 후 인지재활 초기 평가'
      },
      {
        id: '2',
        patientName: '이환자',
        therapist: '박치료사',
        date: '2024-01-15',
        time: '14:00',
        type: 'follow-up',
        status: 'scheduled',
        notes: '운동기능 재활 3주차'
      },
      {
        id: '3',
        patientName: '최환자',
        therapist: '함형광',
        date: '2024-01-16',
        time: '10:30',
        type: 'assessment',
        status: 'scheduled',
        notes: 'ICF 기반 기능평가'
      }
    ];
    setAppointments(sampleAppointments);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAppointment: Appointment = {
      id: Date.now().toString(),
      ...formData,
      status: 'scheduled'
    };
    setAppointments([...appointments, newAppointment]);
    setFormData({
      patientName: '',
      therapist: '',
      date: selectedDate,
      time: '',
      type: 'initial',
      notes: ''
    });
    setShowForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'initial': return 'bg-purple-100 text-purple-800';
      case 'follow-up': return 'bg-orange-100 text-orange-800';
      case 'assessment': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'initial': return '초기 평가';
      case 'follow-up': return '추적 치료';
      case 'assessment': return '기능 평가';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">NeuroRehab Scheduler</h1>
                <p className="text-white/70 text-sm">병원-지역 재활치료 예약 및 알림 자동화</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">오늘 예약</p>
                <p className="text-2xl font-bold text-white">
                  {appointments.filter(apt => apt.date === new Date().toISOString().split('T')[0]).length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">이번 주</p>
                <p className="text-2xl font-bold text-white">
                  {appointments.filter(apt => {
                    const aptDate = new Date(apt.date);
                    const now = new Date();
                    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    return aptDate >= weekStart && aptDate <= weekEnd;
                  }).length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">완료된 치료</p>
                <p className="text-2xl font-bold text-white">
                  {appointments.filter(apt => apt.status === 'completed').length}
                </p>
              </div>
              <User className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">대기 중</p>
                <p className="text-2xl font-bold text-white">
                  {appointments.filter(apt => apt.status === 'scheduled').length}
                </p>
              </div>
              <Bell className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">예약 관리</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-cyan-600 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>새 예약 추가</span>
          </button>
        </div>

        {/* Appointments List */}
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-3">
                    <h3 className="text-lg font-semibold text-white">{appointment.patientName}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                      {appointment.status === 'scheduled' ? '예약됨' : 
                       appointment.status === 'completed' ? '완료' : '취소됨'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(appointment.type)}`}>
                      {getTypeLabel(appointment.type)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/70">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>치료사: {appointment.therapist}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{appointment.date}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{appointment.time}</span>
                    </div>
                  </div>
                  
                  {appointment.notes && (
                    <p className="mt-3 text-sm text-white/60 bg-white/5 rounded-lg p-3">
                      {appointment.notes}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-white/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Appointment Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 w-full max-w-md mx-4 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">새 예약 추가</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">환자명</label>
                  <input
                    type="text"
                    value={formData.patientName}
                    onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="환자명을 입력하세요"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">치료사</label>
                  <input
                    type="text"
                    value={formData.therapist}
                    onChange={(e) => setFormData({...formData, therapist: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="치료사명을 입력하세요"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">날짜</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">시간</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">치료 유형</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as 'initial' | 'follow-up' | 'assessment'})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="initial">초기 평가</option>
                    <option value="follow-up">추적 치료</option>
                    <option value="assessment">기능 평가</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">메모</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="추가 메모를 입력하세요"
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-lg hover:from-purple-600 hover:to-cyan-600 transition-all duration-200"
                  >
                    예약 추가
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Brain icon component
function Brain({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2s-.9-2-2-2H9.5c-.28 0-.5.22-.5.5s.22.5.5.5H12v1h-1c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1h1v3c0 1.1.9 2 2 2h2v1.93c1.7-.2 3.25-1.04 4.4-2.27z"/>
    </svg>
  );
}