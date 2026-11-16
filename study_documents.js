/*
 * =============================================================================
 *   STUDY DOCUMENTS — Curtains Game, Study 1 (Pilot 1)
 * =============================================================================
 *
 *   The consent form and debriefing shown in the task. The wording is copied
 *   from the approved Word documents (Consent_Form_Study1.docx and
 *   Debrief_Study1.docx). If the board asks for wording changes, edit them
 *   here AND in the Word files so the two stay identical.
 *
 *   Plain HTML: <p> for paragraphs, <b> for bold, <ul><li> for bullets.
 * =============================================================================
 */
window.STUDY_DOCUMENTS = {

    letterhead: 'assets/letterhead_ubc_cgr.png',

    // ── Consent form ──────────────────────────────────────────────────────
    consentTitle: 'Consent Form: Online Curtains Game (Study 1)',

    consentBody: `
<p><b>Principal Investigator:</b> Dr. Luke Clark is a Professor of Psychology in the Department of Psychology at the University of British Columbia (email luke.clark@psych.ubc.ca; Phone: 604-827-0618).</p>

<p><b>Co-Investigators:</b> Aidan Campbell is a postdoctoral researcher in Psychology at UBC (Phone: 604-827-0619; Email: aidan.campbell@ubc.ca).</p>

<p><b>Purpose: Why Do We Want You to Play a Chance-based Game?</b> Games of chance, such as many board, card and video games, are played by millions of people, and some feel far more absorbing than others. In this study, you will play a simple chance-based game that lets us examine how different features of a game shape players’ experience of it. By learning more about how people experience games of chance, we hope to better understand what makes some games so engaging.</p>

<p><b>Who May Participate:</b> Your eligibility has already been confirmed based on your Prolific profile. Please take a moment to ensure you still meet the eligibility criteria:</p>
<ul>
  <li>Age 21 or above</li>
  <li>Be a resident of either Canada, the United States of America, Great Britain, Ireland, Australia, or New Zealand</li>
  <li>Be proficient with the English language (reading and writing)</li>
</ul>

<p><b>Procedure:</b> Participation in this study will take around 25 minutes to complete. During this session, you will play two versions of a simple curtain game, one after the other, for 50 rounds each. Before the first game, you will read instructions and answer a few questions to check that the rules are clear. On each round, curtains are removed at random until one curtain is left, and the points behind it (a gain or a loss) are added to your score. You do not need to make any choices during the game. After each game, you will answer some short questions about your experience of the game. At the end, you will answer a few questions about yourself, such as your age and education.</p>

<p><b>Participant Withdrawal:</b> You may stop the experiment at any time without penalty to your per-hour compensation. However, to ensure you receive remuneration you must proceed to the end of the survey to be registered as complete on Prolific. Should you choose to withdraw from the study, your data will not be used in any subsequent analyses or in publication.</p>

<p><b>Study Results:</b> The results of our research will be presented at scientific conferences and in scientific journals. These reports describe findings in groups of participants and do not refer to individual participants. You may follow the research outputs through the Centre for Gambling Research website (www.cgr.psych.ubc.ca).</p>

<p><b>Compensation:</b> You will receive £3.75 for participation. You will also receive a bonus payment based on your points in the curtain game. Your bonus starts at £1.00: every 10 points you win adds 1p, and every 10 points you lose subtracts 1p. Your final bonus is rounded up to the next penny and will be between £0.00 and £2.50. Bonus payments will be made through Prolific after you complete the study.</p>

<p><b>Study Risks:</b> There are no physical risks of participating in this study. We will ask you some questions about yourself and your experience of the game. We will also ask you to play a chance-based game in which you can win or lose points. If you think you may find this upsetting, please contact the researcher. At the end of the experiment, we will give you some information about today’s study and games of chance.</p>

<p><b>Confidentiality:</b> The Centre for Gambling Research at UBC is committed to protecting participant anonymity. The game runs in your web browser, and your responses are sent over an encrypted (SSL) connection to a secure UBC research data collection (the UBC Dataverse Collection on Borealis), which is stored on servers in Canada. The only identifier linking to you will be your Prolific ID, which will be retained alongside a record of your consent to the study but will not be stored alongside your data after data collection has ended. Only the Principal Investigator and Co-Investigators will have access to this data. Your data will be assigned an arbitrary participant number that is not connected to you in any identifiable manner. Raw data will be stored on servers located in Canada and on encrypted and password protected hard drives in a locked laboratory room also located in Canada. All data will be collected and stored under the legal framework of FIPPA.</p>

<p><b>Open Access:</b> Open access refers to the concept of making research data freely available for anybody to view and use. Following study completion, this dataset may be uploaded to public repositories such as Zenodo (https://zenodo.org/) or a UBC data repository. In the uploaded datasheet, any personal identifiers will be removed or condensed. Nevertheless, there is a chance that you or your close family members could re-identify you from unusual combinations of responses. Once the data is made available, you will not be able to withdraw your data.</p>

<p><b>Disclosure:</b> The Centre for Gambling Research at UBC is supported by an award from the British Columbia Lottery Corporation and the BC Government. The terms of this funding ensure the academic independence of the Centre from those bodies: the funders do not have any influence over the research conducted at the Centre and impose no constraints on publishing.</p>

<p><b>Consent:</b> <i><u>Your participation in this study is entirely voluntary, and you may withdraw your consent at any time without penalty academically or otherwise. You do not have to give a reason for withdrawing from the study.</u></i> Your consent to participate in no way overrides or alters any of your legal rights.</p>

<p><b>Contact:</b> If you have any questions or concerns about your involvement in the study, please contact Dr. Luke Clark or Aidan Campbell. The names and telephone numbers are listed at the top of the first page of this form. For more information on us, our lab and our research, visit <i><u>cgr.psych.ubc.ca</u></i>.</p>

<p>If you have any concerns or complaints about your rights as a research participant and/or your experiences while participating in this study, contact the Research Participant Complaint Line in the UBC Office of Research Ethics at 604-822-8598 or if long distance, e-mail RSIL@ors.ubc.ca or call toll free 1-877-822-8598.</p>

<p>Ethics ID: H26-03674</p>
`,

    // Statement and the two choices (BREB 6.6). The first choice starts the study.
    consentStatement: 'Statement of Consent: I have read and understood the above information, and I have given myself time to consider participation. I recognize that selecting the first option below equates to providing a signature of consent to participate in this study.',
    consentYes: 'I have read and understood the above information, and I consent to participate in the study',
    consentNo: 'I have read the above information, and I DO NOT consent to participate in the study',

    // Shown if someone does not consent. Nothing is saved for them.
    declineMessage: `
<p><b>You have chosen not to take part in this study.</b></p>
<p>No data from this session has been saved.</p>
<p>Please close this page and <b>return the study on Prolific</b>. Returning a study does not affect your approval rating.</p>`,

    // ── Debriefing ────────────────────────────────────────────────────────
    debriefTitle: 'Debrief Form: Online Curtains Game (Study 1)',

    debriefBody: `
<p>Thank you for participating in this study. The purpose of this study is to understand what makes some games of chance feel more absorbing than others.</p>

<p>In each round of the curtain game, curtains were removed until only one was left, revealing your points. The two versions of the game you played differed only in how many curtains (possible outcomes) there were in each round: participants were randomly assigned to play either 2 and 32 curtains, or 4 and 16 curtains, in a random order. A round with more possible outcomes resolves more uncertainty, which we describe as delivering more information. We predicted that the version with more possible outcomes would feel more immersive and absorbing, and we will compare your ratings after each game to test this. Many modern slot machines also have a large number of possible outcomes on every spin, so the results will also help us understand why some gambling products are so engaging.</p>

<p>Below we explain how the curtain game worked and list some resources. Once again, we would like to thank you for participating in the study.</p>

<p><b>How the Curtain Game Worked</b></p>

<p>Every curtain was equally likely to be the last one left, and nothing you did could change which curtain remained. The point values were balanced around zero, so <b>on average each round was worth 0 points</b>, and every version of the game had the same average outcome and the same range of outcomes (from −64 to +64 points). Your bonus started at £1.00 and changed by 1p for every 10 points you won or lost, so any bonus above or below £1.00 came down to chance alone.</p>

<p>The curtains that were removed in each round were chosen by a random number generator. No one could predict which curtain would be left, and earlier rounds had no effect on later ones. Even so, many people feel they can see patterns or streaks in random outcomes, and much of our research looks at how people come to hold these beliefs in games of chance and in gambling.</p>

<p>If you have concerns or questions about mental health related to gambling, or are interested in services that are available in your country, we recommend the following resources:</p>
<ul>
  <li><a href="https://www.gamtalk.org/treatment-support/" target="_blank" rel="noopener">Gamtalk Helpful Resources</a></li>
  <li><a href="https://www.ncpgambling.org/programs-resources/resources/" target="_blank" rel="noopener">National Council on Problem Gambling (US) - Resources</a></li>
  <li><a href="https://www.camh.ca/en/health-info/mental-illness-and-addiction-index/problem-gambling" target="_blank" rel="noopener">Centre for Addiction and Mental Health (Canada): Problem Gambling</a></li>
  <li><a href="https://www.nhs.uk/live-well/addiction-support/gambling-addiction/" target="_blank" rel="noopener">NHS help for problem gambling (UK)</a></li>
</ul>
<p>There is more information about gambling behaviour on our lab website, <a href="https://cgr.psych.ubc.ca" target="_blank" rel="noopener">www.cgr.psych.ubc.ca</a>.</p>

<p><b>Contact Information for Questions about the Study</b></p>
<p><i>On behalf of everyone here at the Centre for Gambling Research, thank you for participating in our study! If you have any questions about this project, please do not hesitate to contact the principal investigator, Luke Clark (luke.clark@psych.ubc.ca), or the co-investigator, Aidan Campbell (aidan.campbell@ubc.ca).</i></p>

<p><b>Contact Information for Concerns/Complaints</b></p>
<p><i>If you have any concerns or complaints about your rights as a research participant and/or your experiences while participating in this study, contact the Research Participant Complaint Line in the UBC Office of Research Ethics at 604-822-8598 or if long distance e-mail RSIL@ors.ubc.ca or call toll free 1-877-822-8598.</i></p>
`,
};
