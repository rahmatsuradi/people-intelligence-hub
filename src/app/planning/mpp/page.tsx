"use client";

import React from "react";
import { AppShell, Card, Button } from "@/components/app-shell";

export default function MPPPage() {
  return (
    <AppShell activeNavId="mpp" title="Manpower Planning (MPP)">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manpower Planning</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Perencanaan kebutuhan tenaga kerja, budget headcount, dan pengajuan penambahan karyawan.
            </p>
          </div>
          <Button variant="primary">
            + Ajukan Kebutuhan Baru
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Total Approved Headcount</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">754</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Current Headcount</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">721</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">Open Vacancies</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">33</p>
          </Card>
          <Card padding={false} className="p-4">
            <p className="text-sm font-medium text-slate-500">YTD Attrition Rate</p>
            <p className="mt-2 text-2xl font-bold text-red-500">4.2%</p>
          </Card>
        </div>

        <Card className="overflow-hidden" padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-slate-900 dark:bg-slate-800/50 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 font-semibold">Approved (Q3)</th>
                  <th className="px-6 py-4 font-semibold">Actual</th>
                  <th className="px-6 py-4 font-semibold">Gap</th>
                  <th className="px-6 py-4 font-semibold">Status Pengajuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  <td className="px-6 py-4 font-medium">News & Production</td>
                  <td className="px-6 py-4">240</td>
                  <td className="px-6 py-4">235</td>
                  <td className="px-6 py-4 font-medium text-red-500">-5</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Hiring in Progress</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Technology & IT</td>
                  <td className="px-6 py-4">120</td>
                  <td className="px-6 py-4">118</td>
                  <td className="px-6 py-4 font-medium text-red-500">-2</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Pending Approval</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Sales & Marketing</td>
                  <td className="px-6 py-4">180</td>
                  <td className="px-6 py-4">180</td>
                  <td className="px-6 py-4 font-medium text-slate-400">0</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Fulfilled</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
