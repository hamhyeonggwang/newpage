'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity, 
  Target, 
  Brain,
  Eye,
  Heart,
  Zap,
  Calendar,
  Filter,
  Download
} from 'lucide-react';

interface ICFData {
  domain: string;
  category: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
}

interface PatientData {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  admissionDate: string;
  icfScores: ICFData[];
  progress: number;
  status: 'improving' | 'stable' | 'declining';
}

export default function OTInsight() {
  const [selectedPatient, setSelectedPatient] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('3months');
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  // 샘플 데이터
  const [patients] = useState<PatientData[]>([
    {
      id: '1',
      name: '김환자',
      age: 65,
      diagnosis: '뇌졸중',
      admissionDate: '2024-01-01',
      progress: 75,
      status: 'improving',
      icfScores: [
        { domain: '신체기능', category: '운동기능', score: 85, trend: 'up', color: 'bg-green-500' },
        { domain: '신체기능', category: '감각기능', score: 70, trend: 'up', color: 'bg-blue-500' },
        { domain: '활동', category: '일상생활활동', score: 60, trend: 'up', color: 'bg-purple-500' },
        { domain: '참여', category: '사회참여', score: 45, trend: 'stable', color: 'bg-orange-500' }
      ]
    },
    {
      id: '2',
      name: '이환자',
      age: 58,
      diagnosis: '척수손상',
      admissionDate: '2024-01-10',
      progress: 60,
      status: 'improving',
      icfScores: [
        { domain: '신체기능', category: '운동기능', score: 40, trend: 'up', color: 'bg-green-500' },
        { domain: '신체기능', category: '감각기능', score: 30, trend: 'stable', color: 'bg-blue-500' },
        { domain: '활동', category: '일상생활활동', score: 35, trend: 'up', color: 'bg-purple-500' },
        { domain: '참여', category: '사회참여', score: 25, trend: 'up', color: 'bg-orange-500' }
      ]
    },
    {
      id: '3',
      name: '최환자',
      age: 72,
      diagnosis: '치매',
      admissionDate: '2024-01-15',
      progress: 30,
      status: 'stable',
      icfScores: [
        { domain: '신체기능', category: '인지기능', score: 35, trend: 'stable', color: 'bg-red-500' },
        { domain: '활동', category: '일상생활활동', score: 40, trend: 'down', color: 'bg-purple-500' },
        { domain: '참여', category: '사회참여', score: 20, trend: 'stable', color: 'bg-orange-500' }
      ]
    }
  ]);

  const [icfDomains] = useState([
    { name: '신체기능', icon: Activity, color: 'text-green-400', bgColor: 'bg-green-500/20' },
    { name: '활동', icon: Target, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    { name: '참여', icon: Users, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    { name: '환경요인', icon: Brain, color: 'text-orange-400', bgColor: 'bg-orange-500/20' }
  ]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down': return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'improving': return 'text-green-400 bg-green-500/20';
      case 'stable': return 'text-yellow-400 bg-yellow-500/20';
      case 'declining': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'improving': return '개선 중';
      case 'stable': return '안정';
      case 'declining': return '악화';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">OT Insight</h1>
                <p className="text-white/70 text-sm">ICF Core Set 기반 기능·참여·환경 데이터 시각화</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 환자</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>{patient.name}</option>
              ))}
            </select>
            
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1month">최근 1개월</option>
              <option value="3months">최근 3개월</option>
              <option value="6months">최근 6개월</option>
              <option value="1year">최근 1년</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'overview' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white/10 text-white/70 hover:text-white'
              }`}
            >
              개요
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'detailed' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white/10 text-white/70 hover:text-white'
              }`}
            >
              상세
            </button>
          </div>
        </div>

        {/* ICF Domains Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {icfDomains.map((domain, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${domain.bgColor}`}>
                  <domain.icon className={`w-6 h-6 ${domain.color}`} />
                </div>
                <span className="text-2xl font-bold text-white">
                  {Math.floor(Math.random() * 40) + 60}%
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{domain.name}</h3>
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/70">+5.2% 이번 주</span>
              </div>
            </div>
          ))}
        </div>

        {/* Patient Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Progress Chart */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">진행 상황</h3>
            <div className="space-y-4">
              {patients.map((patient) => (
                <div key={patient.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">{patient.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(patient.status)}`}>
                      {getStatusLabel(patient.status)}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${patient.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-white/70">
                    <span>{patient.diagnosis}</span>
                    <span>{patient.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ICF Scores */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">ICF 점수 분석</h3>
            <div className="space-y-4">
              {selectedPatient === 'all' ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-white/50 mx-auto mb-4" />
                  <p className="text-white/70">환자를 선택하여 상세 분석을 확인하세요</p>
                </div>
              ) : (
                patients
                  .find(p => p.id === selectedPatient)
                  ?.icfScores.map((score, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${score.color}`}></div>
                        <span className="text-white font-medium">{score.category}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-semibold">{score.score}</span>
                        {getTrendIcon(score.trend)}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Detailed ICF Analysis */}
        {viewMode === 'detailed' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Body Functions */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center space-x-3 mb-4">
                <Activity className="w-6 h-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">신체기능</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">운동기능</span>
                  <span className="text-white font-semibold">85점</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">감각기능</span>
                  <span className="text-white font-semibold">70점</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">인지기능</span>
                  <span className="text-white font-semibold">65점</span>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center space-x-3 mb-4">
                <Target className="w-6 h-6 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">활동</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">일상생활활동</span>
                  <span className="text-white font-semibold">60점</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">이동능력</span>
                  <span className="text-white font-semibold">55점</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">의사소통</span>
                  <span className="text-white font-semibold">70점</span>
                </div>
              </div>
            </div>

            {/* Participation */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center space-x-3 mb-4">
                <Users className="w-6 h-6 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">참여</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">사회참여</span>
                  <span className="text-white font-semibold">45점</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">직업활동</span>
                  <span className="text-white font-semibold">30점</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">여가활동</span>
                  <span className="text-white font-semibold">50점</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Patient List */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-4">환자 목록</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patients.map((patient) => (
              <div key={patient.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{patient.name}</h4>
                    <p className="text-white/70 text-sm">{patient.age}세 · {patient.diagnosis}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(patient.status)}`}>
                    {getStatusLabel(patient.status)}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">진행률</span>
                    <span className="text-white font-semibold">{patient.progress}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                      style={{ width: `${patient.progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm text-white/70">
                  <span>입원일: {patient.admissionDate}</span>
                  <button className="text-blue-400 hover:text-blue-300 transition-colors">
                    상세보기 →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}