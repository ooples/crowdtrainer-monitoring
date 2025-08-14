// Accessibility Testing Utilities

export interface TabOrderItem {
  element: HTMLElement;
  tagName: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  textContent?: string;
  tabIndex: number;
}

export interface A11yTestResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
  tabOrder: TabOrderItem[];
  missingLabels: HTMLElement[];
  contrastIssues: HTMLElement[];
}

/**
 * Test keyboard navigation order
 */
export function testTabOrder(): TabOrderItem[] {
  const focusableElements = document.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;

  const tabOrder: TabOrderItem[] = [];

  focusableElements.forEach((element) => {
    const tabIndex = element.tabIndex;
    const item: TabOrderItem = {
      element,
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      ariaLabel: element.getAttribute('aria-label') || undefined,
      textContent: element.textContent?.trim() || undefined,
      tabIndex
    };
    tabOrder.push(item);
  });

  // Sort by tab index, then by DOM order
  return tabOrder.sort((a, b) => {
    if (a.tabIndex !== b.tabIndex) {
      // Elements with tabindex 0 come after positive tabindexes
      if (a.tabIndex === 0 && b.tabIndex > 0) return 1;
      if (b.tabIndex === 0 && a.tabIndex > 0) return -1;
      return a.tabIndex - b.tabIndex;
    }
    // Same tabindex, maintain DOM order
    return Array.from(document.querySelectorAll('*')).indexOf(a.element) -
           Array.from(document.querySelectorAll('*')).indexOf(b.element);
  });
}

/**
 * Find elements missing proper labels
 */
export function findMissingLabels(): HTMLElement[] {
  const issues: HTMLElement[] = [];

  // Check form inputs
  const inputs = document.querySelectorAll('input, select, textarea') as NodeListOf<HTMLElement>;
  inputs.forEach((input) => {
    const hasLabel = input.getAttribute('aria-label') || 
                    input.getAttribute('aria-labelledby') ||
                    document.querySelector(`label[for="${input.id}"]`);
    if (!hasLabel) {
      issues.push(input);
    }
  });

  // Check buttons without text or labels
  const buttons = document.querySelectorAll('button, [role="button"]') as NodeListOf<HTMLElement>;
  buttons.forEach((button) => {
    const hasLabel = button.getAttribute('aria-label') ||
                    button.textContent?.trim() ||
                    button.querySelector('img[alt]') ||
                    button.querySelector('[aria-label]');
    if (!hasLabel) {
      issues.push(button);
    }
  });

  // Check images without alt text
  const images = document.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
  images.forEach((img) => {
    if (!img.alt && !img.getAttribute('aria-label') && img.getAttribute('aria-hidden') !== 'true') {
      issues.push(img);
    }
  });

  return issues;
}

/**
 * Check color contrast (simplified check)
 */
export function checkColorContrast(): HTMLElement[] {
  const issues: HTMLElement[] = [];
  
  // This is a simplified check - in a real implementation you'd calculate actual contrast ratios
  const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, button, a') as NodeListOf<HTMLElement>;
  
  textElements.forEach((element) => {
    const style = window.getComputedStyle(element);
    const color = style.color;
    const backgroundColor = style.backgroundColor;
    
    // Check if element has very light text on very light background (simplified)
    if (color.includes('rgb(200') && backgroundColor.includes('rgb(250')) {
      issues.push(element);
    }
    // Check if element has very dark text on very dark background (simplified)
    if (color.includes('rgb(50') && backgroundColor.includes('rgb(50')) {
      issues.push(element);
    }
  });
  
  return issues;
}

/**
 * Run comprehensive accessibility test
 */
export function runAccessibilityTest(): A11yTestResult {
  const tabOrder = testTabOrder();
  const missingLabels = findMissingLabels();
  const contrastIssues = checkColorContrast();
  
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Check for issues
  if (missingLabels.length > 0) {
    issues.push(`${missingLabels.length} elements are missing proper labels`);
  }
  
  if (contrastIssues.length > 0) {
    warnings.push(`${contrastIssues.length} elements may have contrast issues`);
  }
  
  // Check tab order logical flow
  let hasTabOrderIssues = false;
  for (let i = 1; i < tabOrder.length; i++) {
    const prev = tabOrder[i - 1];
    const current = tabOrder[i];
    
    // Check for large jumps in tab index that might indicate issues
    if (prev.tabIndex > 0 && current.tabIndex > 0 && current.tabIndex - prev.tabIndex > 10) {
      hasTabOrderIssues = true;
      break;
    }
  }
  
  if (hasTabOrderIssues) {
    warnings.push('Tab order may have logical flow issues');
  }
  
  // Check for proper landmarks
  const hasMain = document.querySelector('main, [role="main"]');
  const hasNav = document.querySelector('nav, [role="navigation"]');
  if (!hasMain) {
    issues.push('Page is missing a main landmark');
  }
  if (!hasNav) {
    warnings.push('Page may be missing navigation landmarks');
  }
  
  // Check for proper headings hierarchy
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => 
    parseInt(h.tagName.charAt(1))
  );
  
  let headingIssues = false;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      headingIssues = true;
      break;
    }
  }
  
  if (headingIssues) {
    warnings.push('Heading hierarchy may skip levels');
  }
  
  const passed = issues.length === 0;
  
  return {
    passed,
    issues,
    warnings,
    tabOrder,
    missingLabels,
    contrastIssues
  };
}

/**
 * Print accessibility test results to console
 */
export function printAccessibilityReport(): void {
  const result = runAccessibilityTest();
  
  console.group('🔍 Accessibility Test Results');
  console.log(`Overall Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (result.issues.length > 0) {
    console.group('❌ Issues (Must Fix)');
    result.issues.forEach(issue => console.error(issue));
    console.groupEnd();
  }
  
  if (result.warnings.length > 0) {
    console.group('⚠️ Warnings (Should Fix)');
    result.warnings.forEach(warning => console.warn(warning));
    console.groupEnd();
  }
  
  if (result.tabOrder.length > 0) {
    console.group('🎯 Tab Order');
    result.tabOrder.forEach((item, index) => {
      console.log(`${index + 1}. ${item.tagName}${item.id ? `#${item.id}` : ''}${item.ariaLabel ? ` [${item.ariaLabel}]` : ''}`);
    });
    console.groupEnd();
  }
  
  console.groupEnd();
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testAccessibility = printAccessibilityReport;
}