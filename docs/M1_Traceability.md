# M1 Requirements Traceability

| Requirement | UI | API / Service | Test | Demo Evidence |
|---|---|---|---|---|
| Ranger reports incident | ReportIncidentPage | POST /api/incidents | ReportIncidentPage.test.tsx | Screenshot 01 |
| GPS/manual fallback | ReportIncidentPage | incident schema | ReportIncidentPage.test.tsx | Screenshot 02 |
| Offline reporting | Ranger + IndexedDB | sync service | incidents.test.ts | Screenshot 03 |
| Assigned incidents | MyIncidentsPage | incident access service | MyIncidentsPage.test.tsx | Screenshot 04 |
| Community form | CommunityReportPage | /api/community/reports | CommunityIncident.test.tsx | Screenshot 05 |
| Mock SMS | CommunityReportPage | /api/community/sms | incidents.test.ts | Screenshot 06 |
| Verify/reject | Ops incident detail | status service | IncidentWorkflow.test.tsx | Screenshot 07 |
| Assign ranger | Ops incident detail | assignment service | IncidentWorkflow.test.tsx | Screenshot 08 |
| Start response | Ops incident detail | response service | incidents.test.ts | Screenshot 09 |
| Resolve incident | Ops incident detail | lifecycle service | IncidentWorkflow.test.tsx | Screenshot 10 |
| Incident history | Ops/Ranger detail | incident events | incidents.test.ts | Screenshot 11 |
| Camera review | CameraReviewPage | camera endpoints | CameraReviewPage.test.tsx | Screenshot 12 |