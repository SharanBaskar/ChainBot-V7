import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CouchdbService } from '../couchdb.service';
import { GeminiService } from './gemini.service';  // Updated import
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';

interface Answer {
  text: string;
  next: string;
}

interface Leave {
  id: string;
  rev: string;
  date: string;
  type: string;
  employee: string;
  leaveType: string;
  leaveReason: string;
  startDate: string;
  endDate: string;
  leaveDays: string;
  lossOfPay: string;
}

interface Node {
  type: string;
  text: string;
  options?: string[];  // Make options optional
  answers?: Answer[];
  next?: string;
}

interface DecisionTree {
  startNode: string;
  nodes: { [key: string]: Node };
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  decisionTree: DecisionTree = { startNode: '', nodes: {} };
  currentNode: Node = { type: '', text: '' };
  conversation: { speaker: string; text: string }[] = [];
  userInput = '';
  errorMessage = '';
  isMinimized = true;
  Detials: any = {};
  leaveBalance = 0;
  hasEnteredDecisionTree: boolean = false;
  private debounceTimer: any;
  private autoScrollEnabled: boolean = true;
  private storedEmployeeId: string | null = null;
  submitted: boolean = false; // Flag to track if form has been submitted
  employeeId: string;
  selectedFile: File | null = null;

  @ViewChild('chatContent') private chatContent!: ElementRef;

  constructor(
    private couchdbService: CouchdbService,
    private http: HttpClient,
    private geminiService: GeminiService,
      // Updated service
  ) {    this.employeeId = ''; // or assign a value from the user's data
  }

ngOnInit(): void {
    this.couchdbService.getDecisionTree().subscribe(data => {
      this.decisionTree = data.data;
      this.currentNode = this.decisionTree.nodes[this.decisionTree.startNode];
      this.addMessage('bot', this.currentNode.text);
      this.chatContent.nativeElement.addEventListener('scroll', () => this.onUserScroll());

    });
}
  @ViewChild('inputField')
  inputField!: ElementRef<HTMLInputElement>;

ngAfterViewChecked() {

  this.scrollToBottom();

}
addMessage(speaker: string, text: string): void {
    this.conversation.push({ speaker, text });
    this.scrollToBottom();
}

selectAnswer(answer: Answer): void {
    this.addMessage('user', answer.text);
  
    if (this.currentNode.text === "Type of leave") {
      this.Detials['Type of leave'] = answer.text;
  
      // Validate leave type
      if (!this.validateLeaveType(answer.text)) {
        return;
      }
    }
  
    // Handle form submission
    if (answer.text === 'Submit') {
      this.submitted = true; // Set the flag to true
  
      if (this.currentNode.text === "Are you sure you want to submit the form?") {
        this.sendLeaveApplicationEmail();
      } else if (this.currentNode.text === "Are you sure you want to submit the Bug report form?") {
        this.submitBugTicket();
      } else if (this.currentNode.text === "Are you sure you want to submit the Change Request form?") {
        this.submitChangeRequest();
      } else if (this.currentNode.text === "Are you sure you want to submit the Service Request form?") {
        this.submitSupportRequest();
      }else if (this.currentNode.text === "Are you sure you want to submit the Desktop Support form?") {
        this.submitDesktopSupportRequest();
      }
      return;
    }
  
    this.submitted = false; // Reset the flag if not submitting
  
    // Move to the next node
    this.currentNode = this.decisionTree.nodes[answer.next];
    this.processNode();
}
  
selectDropdownOption(event: Event): void {
  const selectElement = event.target as HTMLSelectElement;
  if (selectElement) {
      const value = selectElement.value;
      
      // Determine the current node's context and update corresponding properties in leaveDetails
      if (this.currentNode.text === 'Priority') {
          this.Detials['Priority'] = value;
      } else if (this.currentNode.text === 'Phase') {
          this.Detials['Phase'] = value;
      } else if (this.currentNode.text === 'Found in') {
          this.Detials['Found in'] = value;
      }else if (this.currentNode.text === 'Severity') {
        this.Detials['Severity'] = value;
      }else if (this.currentNode.text === 'Client'){
        this.Detials['Client'] = value;
      }else if(this.currentNode.text === 'Identified By appBots'){
        this.Detials['Identified By appBots'] = value;
      }else if(this.currentNode.text === 'Module'){
        this.Detials['Module'] = value;
      }else if(this.currentNode.text === 'Location'){
        this.Detials['Location'] = value;
      }

      // Navigate to the next node based on the selected value
      const nextNodeKey = (this.currentNode as any).next[value];
      if (nextNodeKey) {
          this.currentNode = this.decisionTree.nodes[nextNodeKey];
          this.addMessage('user', value);
          this.processNode();
      }
  }
}

submitInput(): void {
    if (!this.userInput.trim()) {
        this.displayErrorMessage('Please enter a value');
        return;
    }

    if (this.currentNode.text === "Contact Number") {
      const phoneNumber = this.userInput.trim();
  
      // Check if input contains only numbers
      if (!/^\d+$/.test(phoneNumber)) {
          this.displayErrorMessage('The phone number should only contain numbers.');
          return; // Exit the function to prevent navigation
      }
  
      // Check if input is exactly 10 digits
      if (phoneNumber.length !== 10) {
          this.displayErrorMessage('The phone number should be exactly 10 digits long.');
          return; // Exit the function to prevent navigation
      }
  }
    if (this.currentNode.text === "Please provide the start date for your leave. (Format: YYYY-MM-DD)") {
        if (!this.validateDate(this.userInput)) {
            return;
        }

        const startDate = new Date(this.userInput);
        const leaveDays = parseInt(this.Detials['No. of days'], 10);

        // Call the method to check for overlapping leave dates
        const employeeId = this.Detials['Please provide your employee ID'];
        this.checkOverlappingLeaveDates(employeeId, this.userInput, leaveDays);
        return; // Exit to prevent further processing until validation is complete
    }

    if (this.currentNode.text === "Please provide the end date for your leave. (Format: YYYY-MM-DD)") {
        if (!this.validateDate(this.userInput)) {
            return;
        }

        const inputDate = new Date(this.userInput);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        inputDate.setHours(0, 0, 0, 0);

        const startDate = new Date(this.Detials['Please provide the start date for your leave. (Format: YYYY-MM-DD)']);
        const leaveDays = parseInt(this.Detials['No. of days'], 10);
        const calculatedEndDate = new Date(startDate);
        calculatedEndDate.setDate(startDate.getDate() + leaveDays - 1);

        if (inputDate.toDateString() !== calculatedEndDate.toDateString()) {
            this.displayErrorMessage(`The end date should be ${calculatedEndDate.toISOString().split('T')[0]}`);
            return;
        }
    }

    if (this.currentNode.text === "No. of days") {
        if (!this.validateLeaveDays(this.userInput)) {
            return;
        }
    }

    if (this.currentNode.text === "Type of leave") {
        if (!this.validateLeaveType(this.userInput)) {
            return;
        }
    }
    if (this.currentNode.text === "Expected date") {
      if (!this.validateDate(this.userInput)) {
          return;
      }
  }

    if (this.currentNode.text === "Enter your employee ID") {
      this.couchdbService.checkEmployeeExists(this.userInput).subscribe(exists => {
        if (!exists) {
          this.displayErrorMessage('The employee ID does not exist. Please enter a valid ID.');
          return;
        }
  
        // Proceed if the ID exists
        this.Detials[this.currentNode.text] = this.userInput;
        this.addMessage('user', this.userInput);
        this.userInput = '';
        this.processUserInput(this.userInput);
      });
  
      return; // Exit to prevent further processing until ID validation is complete
    }
    this.addMessage('user', this.userInput);
    this.errorMessage = '';
    this.Detials[this.currentNode.text] = this.userInput;

    if (this.currentNode.text === "Please provide your employee ID") {
        this.checkEmployeeEligibility(this.userInput);
    } else {
        this.processUserInput(this.userInput);
    }

    this.userInput = '';
}

doNeed(): void {
  // Move to the next node
  this.processUserInput('');
}


checkOverlappingLeaveDates(employeeId: string, startDate: string, leaveDays: number): void {
    const url = `https://192.168.57.185:5984/employee-db/_design/leave/_view/by_employee?key="${employeeId}"`;
    const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2'),
      'Content-Type': 'application/json'
    });
  
    this.http.get<{ rows: { value: Leave }[] }>(url, { headers }).subscribe(
      response => {
        const leaves = response.rows.map(row => row.value);
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + leaveDays - 1);
  
        const hasOverlappingLeave = leaves.some((leave: Leave) => {
          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          return (start >= leaveStart && start <= leaveEnd) || (end >= leaveStart && end <= leaveEnd);
        });
  
        if (hasOverlappingLeave) {
          this.displayErrorMessage('You have already applied for leave on the selected dates.');
          this.currentNode = this.decisionTree.nodes['node7'];
          this.processNode();
          return;
        } else {
          // No overlap, proceed with adding the message
          this.addMessage('user', this.userInput);
          this.errorMessage = '';
          this.Detials[this.currentNode.text] = this.userInput;
          this.processUserInput(this.userInput);
        }
      },
      error => {
        console.error('Error fetching employee data:', error);
        this.displayErrorMessage('Failed to retrieve employee data.');
        this.currentNode = this.decisionTree.nodes['node12'];
        this.processNode();
      }
    );
}
  
validateLeaveDays(days: string): boolean {
    const leaveDays = parseInt(days, 10);
    if (isNaN(leaveDays)) {
        this.displayErrorMessage('Please enter a valid number for leave days');
        return false;
    }

    if (leaveDays <= 0) {
        this.displayErrorMessage('Number of days must be greater than 0');
        return false;
    }

    const leaveType = this.Detials['Type of leave']; // Get the selected leave type
    const casualLeaveBalance = this.Detials['casualLeaveBalance'];
    const medicalLeaveBalance = this.Detials['medicalLeaveBalance'];

    if (leaveType === 'Casual Leave') {
        if (leaveDays > casualLeaveBalance) {
            this.addMessage('bot', `You have ${casualLeaveBalance} casual leave days available.`);
            this.currentNode = this.decisionTree.nodes['node6']; // Adjust node as needed
            this.processNode();
            return false;
        }
    } else if (leaveType === 'Medical Leave') {
        if (leaveDays > medicalLeaveBalance) {
            this.addMessage('bot', `You have ${medicalLeaveBalance} medical leave days available.`);
            this.currentNode = this.decisionTree.nodes['node6']; // Adjust node as needed
            this.processNode();
            return false;
        }
    } else if (this.leaveBalance === 0) {
        // Handle loss of pay if no leave balance is available
        this.Detials['No. of days'] = leaveDays.toString();
        this.Detials['Loss of pay'] = 'Yes'; // Mark as loss of pay
        return true;
    } else {
        // Handle fallback if the leave type is not recognized or other issues
        this.displayErrorMessage('Invalid leave type or unexpected error.');
        return false;
    }

    // If all checks pass
    this.Detials['No. of days'] = leaveDays.toString();
    return true;
}
  
validateLeaveType(type: string): boolean {
  const leaveType = this.Detials['Type of leave']; // Get the selected leave type
  
  if (leaveType === 'Casual Leave' && this.Detials['casualLeaveBalance'] === 0) {
    this.displayErrorMessage('You have 0 casual leave days available. Please select another type of leave.');
    return false;
  }

  if (leaveType === 'Medical Leave' && this.Detials['medicalLeaveBalance'] === 0) {
    this.displayErrorMessage('You have 0 medical leave days available. Please select another type of leave.');
    return false;
  }

  return true;
}

validateDate(date: string): boolean {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
      this.displayErrorMessage('Please enter a valid date in the format YYYY-MM-DD');
      return false;
    }
  
    const inputDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    inputDate.setHours(0, 0, 0, 0);
  
    // Calculate the start and end of the valid range
    const startOfRange = new Date(today.getFullYear(), today.getMonth(), 28);
    startOfRange.setMonth(today.getMonth() - 1);
    
    // Adjust range if today is past the 27th
    if (today.getDate() >= 27) {
      startOfRange.setMonth(today.getMonth());
    }
  
    // Define the end of the current year
    const endOfYear = new Date(today.getFullYear(), 11, 31);
  
    // Check if input date is within the valid range
    if (inputDate < startOfRange) {
      this.displayErrorMessage(`The start date must be above ${startOfRange.toISOString().split('T')[0]}.`);
      return false;
    }
    
    // Check if input date is within the current year
    if (inputDate > endOfYear) {
      this.displayErrorMessage(`The date must not be beyond ${endOfYear.toISOString().split('T')[0]}.`);
      return false;
    }
  
    return true;
}
  
checkEmployeeEligibility(employeeId: string): void {
    // URLs for employee and leave data
    const employeeUrl = `https://192.168.57.185:5984/employee-db/employee_2_${employeeId}`;
    const leaveUrl = `https://192.168.57.185:5984/employee-db/leave_2_${employeeId}`;

    // Set headers for authentication
    const headers = new HttpHeaders({
        'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
    });
    
    // Fetch employee data
    this.http.get<any>(employeeUrl, { headers }).subscribe(
        employeeResponse => {
            const employeeData = employeeResponse.data;

            if (employeeData && employeeData.eligible) {
                // Store the valid employee ID
                this.storedEmployeeId = employeeId;
                this.Detials['Please provide your employee ID'] = employeeId;

                // Fetch leave data if employee is eligible
                this.http.get<any>(leaveUrl, { headers }).subscribe(
                    leaveResponse => {
                        const leaveData = leaveResponse.data;

                        if (leaveData) {
                            // Assign leave balances and employee name
                            this.leaveBalance = leaveData.leaveBalance || 0;
                            this.Detials['leaveBalance'] = this.leaveBalance;
                            this.Detials['casualLeaveBalance'] = leaveData.casualLeaveBalance || 0;
                            this.Detials['medicalLeaveBalance'] = leaveData.medicalLeaveBalance || 0;
                            this.Detials['employeename'] = employeeData.employeename || 'Employee';

                            // Determine if the employee is eligible for leave
                            if (this.leaveBalance > 0 || this.Detials['Loss of pay'] === 'Yes') {
                                this.currentNode = this.decisionTree.nodes['nodeEligibilityResult'];
                            } else {
                                this.Detials['Type of leave'] = 'Loss of Pay';
                                this.currentNode = this.decisionTree.nodes['node11'];
                            }

                            this.processNode();
                        } else {
                            this.addMessage('bot', 'No leave data found.');
                            this.currentNode = this.decisionTree.nodes['node12'];
                            this.processNode();
                        }
                    },
                    error => {
                        console.error('Error fetching leave data:', error);
                        this.addMessage('bot', 'Failed to retrieve leave data.');
                        this.currentNode = this.decisionTree.nodes['node12'];
                        this.processNode();
                    }
                );
            } else {
                // Invalid employee ID - ask for ID again
                this.addMessage('bot', 'Employee is not eligible for leave. Please provide a valid employee ID.');
                this.currentNode = this.decisionTree.nodes['node3']; // Assuming 'node3' is where the ID is requested
                this.userInput = ''; // Clear the input for re-entry
                this.processNode();
            }
        },
        error => {
            console.error('Error fetching employee data:', error);
            this.addMessage('bot', 'No employee record found. Please provide a valid employee ID.');
            this.currentNode = this.decisionTree.nodes['node3']; // Re-prompt for employee ID
            this.userInput = ''; // Clear the input for re-entry
            this.processNode();
        }
    );
}

async processUserInput(input: string): Promise<void> {
  let correctedInput: string = input; // Start with the original input

  // Step 1: Check if the input is in the cache
  const cachedCorrection = this.geminiService.getCorrectionCache(input);
  if (cachedCorrection) {
    correctedInput = cachedCorrection;
    console.log('Corrected Input from Cache:', correctedInput);

  } else {
    // Step 2: Correct spelling errors with Gemini AI only if the decision tree has not been entered
    if (!this.hasEnteredDecisionTree) {
      try {
        // Suggest correction and check if there's a difference
        const suggestion = await this.geminiService.suggestCorrection(input);
        if (suggestion !== input) {
          correctedInput = suggestion;
          // Store the corrected input in the cache
          this.geminiService.setCorrectionCache(input, correctedInput);
        }
      } catch (error) {
        console.error('Error getting spelling correction from Gemini:', error);
        // Fallback to the original input if there's an error
        correctedInput = input;
      }
    }
  }

  // Step 3: Map corrected input to the next node based on predefined keywords or phrases
  const keywordMappings: { [key: string]: string } = {

        // Desktop Support-related keywords (node17)
        "desktop support": "node17",
        "support desktop": "node17",
        "Desktop Service":"node17",

    // Leave-related keywords
    "apply for leave": "node2", "take leave": "node2", "leave application": "node2",
    "request leave": "node2", "leave request": "node2", "book leave": "node2",
    "submit leave": "node2", "apply leave": "node2","i want to tke levae":"node2","like to request a leave of absence":"node2",
    
    // Leave balance-related keywords
    "check leave balance": "node2", "leave balance": "node2",
    "leave status": "node2", "remaining leave": "node2", "available leave": "node2",
    "leave summary": "node2", "how many leaves": "node2",
  
    // Support-related keywords
    "support request": "node14", "raise support": "node14", "support": "node14",
    "get support": "node14", "support ticket": "node14", "help ticket": "node14",
  
    // Change request-related keywords
    "change request": "node14", "raise change request": "node14",
    "request change": "node14", "submit change request": "node14",
    "modify request": "node14", "change order": "node14",
  
    // Service request-related keywords
    "service request": "node14", "raise service request": "node14",
    "request service": "node14", "submit service request": "node14",
    "service help": "node14",
  
    // Bug report-related keywords
    "report bug": "node14", "bug": "node14", "bgu": "node14", "raise bug": "node14",
    "submit bug": "node14", "log bug": "node14", "bug report": "node14",
    "report issue": "node14", "file bug": "node14",
    
  };
  

  // Normalize the corrected input for accurate matching
  const normalizedCorrectedInput = correctedInput.toLowerCase().trim();

  let matchedKeyword = null;
  let nextNode = this.currentNode?.next || '';
  for (const keyword in keywordMappings) {
    if (normalizedCorrectedInput.includes(keyword.toLowerCase())) {
      matchedKeyword = keyword;
      nextNode = keywordMappings[keyword];
      break;
    }
  }

  // Handle case where no keywords are matched
  if (!nextNode) {
    nextNode = 'node15'; // Default node when no match is found
  }

  // Mark that the decision tree has been entered
  if (!this.hasEnteredDecisionTree) {
    this.hasEnteredDecisionTree = true;
  }

  // Check if we are at an end node or reset point
  if (nextNode === 'node13' || nextNode === 'node12') {
    this.hasEnteredDecisionTree = false; // Reset the flag
  }

  if (nextNode) {
    this.currentNode = this.decisionTree.nodes[nextNode || ''];
    this.processNode();
  }
}

processNode(): void {
  if (!this.currentNode) {
      console.error('Invalid node configuration');
      return;
  }

  // Skip employee ID prompt if already stored
  if (this.currentNode === this.decisionTree.nodes['node3'] && this.storedEmployeeId) {
      this.checkEmployeeEligibility(this.storedEmployeeId);
      return; // Exit early as we are processing the ID automatically
  }

  if (this.currentNode.type === 'question' && this.currentNode.text === 'No. of days') {
      const maxDays = Math.min(this.leaveBalance, 5);
      this.currentNode.answers = this.currentNode.answers?.filter(answer => parseInt(answer.text, 10) <= maxDays);
  }

  const botMessage = this.replaceVariables(this.currentNode.text);
  this.addMessage('bot', botMessage);
}

replaceVariables(text: string): string {
    return text.replace(/\[\w+\]/g, match => this.Detials[match.slice(1, -1)] || match);
}

sendLeaveApplicationEmail(): void {
    const employeeId = this.Detials['Please provide your employee ID'];
  
    // URLs for employee and leave data
    const employeeUrl = `https://192.168.57.185:5984/employee-db/employee_2_${employeeId}`;
    const headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2')
    });
  
    // Fetch employee data
    this.http.get<any>(employeeUrl, { headers }).subscribe(
      employeeResponse => {
        const employeeData = employeeResponse.data;
  
        if (employeeData) {
          const templateParams = {
            employee_name: employeeData.employeename,
            employee_email: employeeData.mailid,
            manager_email: employeeData.mmailid,
            employee_id: employeeData.employeeId,
            leave_type: this.Detials['Type of leave'] || 'Loss of Pay',
            leave_reason: this.Detials['Reason for the leave'],
            leave_days: this.Detials['No. of days'],
            start_date: this.Detials['Please provide the start date for your leave. (Format: YYYY-MM-DD)'],
            end_date: this.Detials['Please provide the end date for your leave. (Format: YYYY-MM-DD)']
          };
  
          // Function to send email using specified service and template
          const sendEmail = (serviceId: string, templateId: string, publicKey: string) => {
            return emailjs.send(serviceId, templateId, templateParams, publicKey);
          };
  
          // Attempt to send email with primary service ID, template ID, and public key
          sendEmail('service_ktikbtc', 'template_epo6kcn', 'QVAF5IuB_-FAI3Hzm').then(
            (response: EmailJSResponseStatus) => {
              console.log('SUCCESS with primary service!', response.status, response.text);
              this.updateLeaveBalance(employeeId, this.Detials['No. of days']);
            },
            (error) => {
              console.error('FAILED with primary service (service_ktikbtc)...', error);
              // Retry with the secondary service ID, template ID, and public key if the primary one fails
              sendEmail('service_ytc3dhd', 'template_djzerod', 'wZfmLdwQgDPM5CW0T').then(
                (response: EmailJSResponseStatus) => {
                  console.log('SUCCESS with secondary service!', response.status, response.text);
                  this.updateLeaveBalance(employeeId, this.Detials['No. of days']);
                },
                (error) => {
                  console.error('FAILED with secondary service (service_42js3h1)...', error);
                }
              );
            }
          );
        } else {
          console.error('No employee data found.');
        }
      },
      error => {
        console.error('Error fetching employee data:', error);
      }
    );
}
  
updateLeaveBalance(employeeId: string, leaveDays: string): void {
  const url = `https://192.168.57.185:5984/employee-db/leave_2_${employeeId}`;
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2'),
    'Content-Type': 'application/json'
  });

  this.http.get<any>(url, { headers }).subscribe(
    response => {
      
      const data = response.data; // Access the nested data object
      
      if (data && (data.leaveBalance >= parseInt(leaveDays, 10) || this.Detials['Loss of pay'] === 'Yes')) {
        if (this.Detials['Loss of pay'] !== 'Yes') {
          data.leaveBalance -= parseInt(leaveDays, 10);
        }
        const leaveDaysInt = parseInt(leaveDays, 10);

        console.log('Leave details:', this.Detials);
  
        let leaveType = this.Detials['Type of leave'];
        let sufficientBalance = false;
         
        // Check if there is sufficient leave balance
        if (leaveType.toLowerCase() === 'casual leave' && data.casualLeaveBalance >= leaveDaysInt) {
          sufficientBalance = true;
          console.log(`Casual Leave Balance before deduction: ${data.casualLeaveBalance}`);
          if (this.Detials['Loss of pay'] !== 'Yes') {
            data.casualLeaveBalance -= leaveDaysInt;
            console.log(`Casual Leave Balance after deduction: ${data.casualLeaveBalance}`);
          }
        } else if (leaveType.toLowerCase() === 'medical leave' && data.medicalLeaveBalance >= leaveDaysInt) {
          sufficientBalance = true;
          console.log(`Medical Leave Balance before deduction: ${data.medicalLeaveBalance}`);
          if (this.Detials['Loss of pay'] !== 'Yes') {
            data.medicalLeaveBalance -= leaveDaysInt;
            console.log(`Medical Leave Balance after deduction: ${data.medicalLeaveBalance}`);
          }
        } else if (this.Detials['Loss of pay'] === 'Yes') {
          sufficientBalance = true;
          console.log('Leave under Loss of Pay option.');
        }
  
        
        if (sufficientBalance) {
          const newLeaveId = `leave_${employeeId}_${Date.now()}`;

          const newLeaveDocument = {
            _id: newLeaveId,
            type: "leave",
            employeeId: employeeId,
            employee: employeeId,
            leaveType: this.Detials['Type of leave'],
            leaveReason: this.Detials['Reason for the leave'],
            startDate: this.Detials['Please provide the start date for your leave. (Format: YYYY-MM-DD)'],
            endDate: this.Detials['Please provide the end date for your leave. (Format: YYYY-MM-DD)'],
            leaveDays: this.Detials['No. of days'],
            lossOfPay: this.Detials['Loss of pay'] || 'No',
            date: new Date().toISOString()
          };

          // Save the new leave document
          this.http.put(`https://192.168.57.185:5984/employee-db/${newLeaveId}`, newLeaveDocument, { headers }).subscribe(
            () => {
              console.log('New leave document created successfully.');

              // Update the employee document with the new leave balances
              this.http.put(url, response, { headers }).subscribe(
                () => {
                  console.log('Employee leave balance updated successfully.');
                  this.currentNode = this.decisionTree.nodes['node10'];
                  this.processNode();
                },
                error => {
                  console.error('Error updating employee leave balance:', error);
                }
              );
            },
            error => {
              console.error('Error creating new leave document:', error);
            }
          );
        } else {
          this.addMessage('bot', 'Insufficient leave balance.');
          this.currentNode = this.decisionTree.nodes['node12'];
          this.processNode();
        }
      } else {
        this.addMessage('bot', 'Failed to retrieve employee data.');
        this.currentNode = this.decisionTree.nodes['node12'];
        this.processNode();
      }
    },
    error => {
      console.error('Error fetching employee data:', error);
      this.addMessage('bot', 'Failed to retrieve employee data.');
      this.currentNode = this.decisionTree.nodes['node12'];
      this.processNode();
    }
  );
}
  
// Function to generate a new unique document ID
generateDocumentId(employeeId: string, subtype: string): string {
  // Generate a unique ID for the ticket
  const uniqueId = `Service_Request_${employeeId}_${subtype}_${Date.now()}`;
  return uniqueId;
}

saveTicketDocument(ticketDocument: any, url: string, headers: HttpHeaders, ticketId: string): void {
  // Save the ticket document to CouchDB
  this.http.put(url, ticketDocument, { headers }).subscribe(
    () => {
      console.log('Bug ticket created successfully with attachment.');
      this.addMessage('bot', `Your ticket ID is ${ticketId}! You will receive a confirmation email shortly.`);
      this.currentNode = this.decisionTree.nodes['node12'];
      this.processNode();
    },
    error => {
      console.error('Error creating Bug ticket:', error);
      this.addMessage('bot', 'Failed to create Bug ticket. Please try again.');
      this.currentNode = this.decisionTree.nodes['node12'];
      this.processNode();
    }
  );
}

handleFileInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    this.selectedFile = input.files[0];
  }
}

uploadScreenshot(): void {
  if (!this.selectedFile) {
    this.addMessage('bot', 'Please select a file to upload.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const base64Image = reader.result as string; // Base64 encoded image
    this.moveToNextNode();
  };
  reader.readAsDataURL(this.selectedFile);
}

moveToNextNode(): void {
  if (this.currentNode && this.currentNode.next) {
    this.currentNode = this.decisionTree.nodes[this.currentNode.next];
    this.processNode();  // Ensure this processes the next node
  }
}

// Function to handle Bug ticket submission
submitBugTicket(): void {
  const employeeId = this.Detials['Enter your employee ID'];
  const title = this.Detials['Title'];
  const client = this.Detials['Client'];
  const instanceName = this.Detials['Instance Name'];
  const productTeam = this.Detials['Product/Team'];
  const component = this.Detials['Component & Sub Component'];
  const severity = this.Detials['Severity'];
  const priority = this.Detials['Priority'];
  const phase = this.Detials['Phase'];
  const foundIn = this.Detials['Found in'];
  const identifiedByappBots = this.Detials['Identified By appBots'];
  const testEnvironment = this.Detials['Test Environment & Details'];
  const assignedTo = this.Detials['Assigned to'];
  const createdFor = this.Detials['Created for Vulnerability'];
  const plannedReleaseVersion = this.Detials['Planned Release Version'];
  const detailedDescription = this.Detials['Detailed Description'];
  const stepsToReproduce = this.Detials['Steps to Reproduce'];
  const expectedResult = this.Detials['Expected Result'];
  const actualResult = this.Detials['Actual Result'];

  // Generate a unique document ID
  const ticketId = this.generateDocumentId(employeeId, "bug");
  const url = `https://192.168.57.185:5984/employee-db/${ticketId}`;
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2'),
    'Content-Type': 'application/json'
  });

  // Prepare the ticket document
  const ticketDocument: any = {
    _id: ticketId,
    type: "SR",
    subtype: "Bug",
    employeeId: employeeId,
    title: title,
    client: client,
    instanceName: instanceName,
    productTeam: productTeam,
    component: component,
    severity: severity,
    priority: priority,
    phase: phase,
    foundIn: foundIn,
    Identified_By_appBots: identifiedByappBots,
    test_Environment: testEnvironment,
    assigned_To: assignedTo,
    created_For_Vulnerability: createdFor,
    planned_Release_Version: plannedReleaseVersion,
    detailed_Description: detailedDescription,
    steps_To_Reproduce: stepsToReproduce,
    expected_Result: expectedResult,
    actual_Result: actualResult,
    date: new Date().toISOString(),
  };

  // Step 1: Handle file upload, if a screenshot is selected
  if (this.selectedFile) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;  // Base64 encoded image
      const attachmentName = "screenshot.png";

      // Step 2: Add the screenshot to the ticket document as an attachment
      ticketDocument._attachments = {
        [attachmentName]: {
          content_type: "image/png",
          data: base64Image.split(',')[1]  // Base64 data without the prefix
        }
      };

      // Step 3: Save the ticket document with the screenshot
      this.saveTicketDocument(ticketDocument, url, headers, ticketId);
    };

    // Read the selected file as base64
    reader.readAsDataURL(this.selectedFile);
  } else {
    // Step 4: If no screenshot is selected, save the ticket without an attachment
    this.saveTicketDocument(ticketDocument, url, headers, ticketId);
  }
}

// Function to handle Change Request ticket submission
submitChangeRequest(): void {
  const employeeId = this.Detials['Enter your employee ID'];
  const title = this.Detials['Title'];
  const client = this.Detials['Client'];
  const instanceName = this.Detials['Instance Name'];
  const productTeam = this.Detials['Product/Team'];
  const component = this.Detials['Component & Sub Component'];
  const severity = this.Detials['Severity'];
  const priority = this.Detials['Priority'];
  const identifiedBy = this.Detials['Identified By appBots'];
  const testEnvironment = this.Detials['Test Environment & Details'];
  const assignedTo = this.Detials['Assigned to'];
  const createdFor = this.Detials['Created for Vulnerability'];
  const plannedReleaseVersion = this.Detials['Planned Release Version'];
  const detailedDescription = this.Detials['Detailed Description'];

  // Generate a unique document ID
  const ticketId = this.generateDocumentId(employeeId, "change_request");
  const url = `https://192.168.57.185:5984/employee-db/${ticketId}`;
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2'),
    'Content-Type': 'application/json'
  });

  // Prepare the ticket document
  const ticketDocument: any = {
    _id: ticketId,
    type: "SR",
    subtype: "Change Request",
    employeeId: employeeId,
    title: title,
    client: client,
    instanceName: instanceName,
    productTeam: productTeam,
    component: component,
    severity: severity,
    priority: priority,
    identifiedBy: identifiedBy,
    testEnvironment: testEnvironment,
    assignedTo: assignedTo,
    createdFor: createdFor,
    plannedReleaseVersion: plannedReleaseVersion,
    detailedDescription: detailedDescription,
    date: new Date().toISOString()
  };

  // Step 1: Handle file upload, if a screenshot is selected
  if (this.selectedFile) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;  // Base64 encoded image
      const attachmentName = "screenshot.png";

      // Step 2: Add the screenshot to the ticket document as an attachment
      ticketDocument._attachments = {
        [attachmentName]: {
          content_type: "image/png",
          data: base64Image.split(',')[1]  // Base64 data without the prefix
        }
      };

      // Step 3: Save the ticket document with the screenshot
      this.saveTicketDocument(ticketDocument, url, headers, ticketId);
    };

    // Read the selected file as base64
    reader.readAsDataURL(this.selectedFile);
  } else {
    // Step 4: If no screenshot is selected, save the ticket without an attachment
    this.saveTicketDocument(ticketDocument, url, headers, ticketId);
  }
}

// Function to handle Service Request ticket submission
submitSupportRequest(): void {
  const employeeId = this.Detials['Enter your employee ID'];
  const title = this.Detials['Title'];
  const client = this.Detials['Client'];
  const instanceName = this.Detials['Instance Name'];
  const productTeam = this.Detials['Product/Team'];
  const component = this.Detials['Component & Sub Component'];
  const priority = this.Detials['Priority'];
  const assignedTo = this.Detials['Assigned to'];
  const detailedDescription = this.Detials['Detailed Description'];

  // Generate a unique document ID
  const ticketId = this.generateDocumentId(employeeId, "support_request");
  const url = `https://192.168.57.185:5984/employee-db/${ticketId}`;
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2'),
    'Content-Type': 'application/json'
  });

  // Prepare the ticket document
  const ticketDocument: any = {
    _id: ticketId,
    type: "SR",
    subtype: "Service Request",
    employeeId: employeeId,
    title: title,
    client: client,
    instanceName: instanceName,
    productTeam: productTeam,
    component: component,
    priority: priority,
    assignedTo: assignedTo,
    detailedDescription: detailedDescription,
    date: new Date().toISOString()
  };

  // Step 1: Handle file upload, if a screenshot is selected
  if (this.selectedFile) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;  // Base64 encoded image
      const attachmentName = "screenshot.png";

      // Step 2: Add the screenshot to the ticket document as an attachment
      ticketDocument._attachments = {
        [attachmentName]: {
          content_type: "image/png",
          data: base64Image.split(',')[1]  // Base64 data without the prefix
        }
      };

      // Step 3: Save the ticket document with the screenshot
      this.saveTicketDocument(ticketDocument, url, headers, ticketId);
    };

    // Read the selected file as base64
    reader.readAsDataURL(this.selectedFile);
  } else {
    // Step 4: If no screenshot is selected, save the ticket without an attachment
    this.saveTicketDocument(ticketDocument, url, headers, ticketId);
  }
}

generateDocumentId1(employeeId: string): string {
  // Generate a unique ID for the ticket
  const uniqueId = `Desktop_Support_${employeeId}_${Date.now()}`;
  return uniqueId;
}

saveTicketDocument1(ticketDocument: any, url: string, headers: HttpHeaders, ticketId: string): void {
  // Save the ticket document to CouchDB
  this.http.put(url, ticketDocument, { headers }).subscribe(
    () => {
      console.log('Bug ticket created successfully with attachment.');
      this.addMessage('bot', `Your ticket ID is ${ticketId}! You will receive a confirmation email shortly.`);
      this.currentNode = this.decisionTree.nodes['node12'];
      this.processNode();
    },
    error => {
      console.error('Error creating Bug ticket:', error);
      this.addMessage('bot', 'Failed to create Bug ticket. Please try again.');
      this.currentNode = this.decisionTree.nodes['node12'];
      this.processNode();
    }
  );
}

submitDesktopSupportRequest(): void {
  const employeeId = this.Detials['Enter your employee ID'];
  const module = this.Detials['Module'];
  const title = this.Detials['Title of the issue'];
  const contactNumber = this.Detials['Contact Number'];
  const location = this.Detials['Location'];
  const expectedDate = this.Detials['Expected date'];
  const problemDescription = this.Detials['Problem Description'];

  console.log('Desktop Support Request:', { employeeId, module, title, contactNumber, location, expectedDate, problemDescription });

  const ticketId = this.generateDocumentId1(employeeId);
  const url = `https://192.168.57.185:5984/employee-db/${ticketId}`;
  const headers = new HttpHeaders({
    'Authorization': 'Basic ' + btoa('d_couchdb:Welcome#2'),
    'Content-Type': 'application/json'
  });

  const supportRequestDocument: any = {
    _id: ticketId,
    type: "DS",
    subtype: "Desktop Support",
    employeeId: employeeId,
    module: module,
    title: title,
    contactNumber: contactNumber,
    location: location,
    expectedDate: expectedDate,
    problemDescription: problemDescription,
    date: new Date().toISOString(),
  };

  // Handle screenshot if present
  if (this.selectedFile) {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Image = reader.result as string;  // Base64 encoded image
      const attachmentName = "screenshot.png";

      supportRequestDocument._attachments = {
        [attachmentName]: {
          content_type: "image/png",
          data: base64Image.split(',')[1]  // Base64 data without the prefix
        }
      };

      // Save the document with the screenshot
      this.saveTicketDocument1(supportRequestDocument, url, headers, ticketId);
    };
    reader.readAsDataURL(this.selectedFile);
  } else {
    // Save the document without the screenshot
    this.saveTicketDocument1(supportRequestDocument, url, headers, ticketId);
  }
}

toggleMinimize(event?: Event): void {
  if (event) {
    event.stopPropagation();
  }
  this.isMinimized = !this.isMinimized;
}

closeChat(event?: Event): void {
  const confirmClose = confirm("Are you sure you want to close the chat?");
  if (confirmClose) {
    if (event) {
      event.stopPropagation();
    }
    // Preserve the initial message and clear the rest
    if (this.conversation.length > 0) {
      this.conversation = [this.conversation[0]];
    }

    this.isMinimized = !this.isMinimized;
  }
}

// Flag to control automatic scrolling
private scrollToBottom(): void {
  try {
    if (this.autoScrollEnabled) {
      this.chatContent.nativeElement.scrollTop = this.chatContent.nativeElement.scrollHeight;
    }
  } catch (err) {
    console.error('Scroll to bottom failed:', err);
  }
}
// Call this method when the user scrolls manually
private onUserScroll(): void {
  const element = this.chatContent.nativeElement;
  this.autoScrollEnabled = element.scrollHeight - element.scrollTop === element.clientHeight;
}

displayErrorMessage(message: string): void {
  this.addMessage('bot', message);
}
}

